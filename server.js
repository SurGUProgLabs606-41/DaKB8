
import express from "express";
import cors from "cors";
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

/*
 * Все данные для таблиц интерфейса формируются SQL-запросами к PostgreSQL.
 * Названия полей здесь совпадают с ключами tableConfig в App.vue.
 */
const selectQueries = {
  objects: `
    SELECT id, name, address, 'Активен' AS status
    FROM trading_object
    ORDER BY id`,
  areas: `
    SELECT ta.id, ta.room_number AS name, tob.name AS object,
           ta.area, ta.floor, ta.purpose, ta.cost, ta.status
    FROM trading_area ta
    JOIN trading_object tob ON tob.id = ta.object_id
    ORDER BY ta.id`,
  tenants: `
    SELECT id,
      CASE WHEN type = 'Юридическое лицо' THEN organization_name
           ELSE CONCAT_WS(' ', first_name, last_name, middle_name) END AS name,
      CASE WHEN type = 'Юридическое лицо'
           THEN CONCAT_WS(' ', first_name, last_name, middle_name)
           ELSE '' END AS contact,
      inn, email, address, phone, type AS status
    FROM tenant
    ORDER BY id`,
  employees: `
    SELECT id, CONCAT_WS(' ', first_name, last_name, middle_name) AS name,
           position, email, phone, 'Работает' AS status
    FROM employee
    ORDER BY id`,
  contracts: `
    SELECT rc.id, rc.contract_number AS name, tob.name AS object,
           ta.room_number AS room,
           CASE WHEN t.type = 'Юридическое лицо' THEN t.organization_name
                ELSE CONCAT_WS(' ', t.first_name, t.last_name, t.middle_name) END AS tenant,
           CONCAT_WS(' ', e.first_name, e.last_name, e.middle_name) AS employee,
           rc.start_date AS "startDate", rc.end_date AS "endDate",
           rc.cost AS "monthlyCost", rc.status
    FROM rental_contract rc
    JOIN trading_area ta ON ta.id = rc.area_id
    JOIN trading_object tob ON tob.id = ta.object_id
    JOIN tenant t ON t.id = rc.tenant_id
    JOIN employee e ON e.id = rc.employee_id
    ORDER BY rc.id`,
  payments: `
    SELECT rp.id, rc.contract_number AS name, rp.period,
           rp.amount, rp.payment_date AS "paymentDate", rp.status
    FROM rental_payment rp
    JOIN rental_contract rc ON rc.id = rp.contract_id
    ORDER BY rp.id`,
};

const tableNames = {
  objects: "trading_object",
  areas: "trading_area",
  tenants: "tenant",
  employees: "employee",
  contracts: "rental_contract",
  payments: "rental_payment",
};

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/dashboard", async (_req, res) => {
  try {
    const [objects, areas, contracts, overdue, payments] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM trading_object"),
      pool.query("SELECT COUNT(*)::int AS count FROM trading_area"),
      pool.query("SELECT COUNT(*)::int AS count FROM rental_contract WHERE status = 'Действует'"),
      pool.query("SELECT COUNT(*)::int AS count FROM rental_contract WHERE status = 'Просрочен'"),
      pool.query("SELECT COUNT(*)::int AS count FROM rental_payment WHERE status = 'Ожидает оплаты'"),
    ]);

    res.json({
      objects: objects.rows[0].count,
      areas: areas.rows[0].count,
      activeContracts: contracts.rows[0].count,
      overdueContracts: overdue.rows[0].count,
      pendingPayments: payments.rows[0].count,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/:section", async (req, res, next) => {
  const query = selectQueries[req.params.section];

  if (!query) return next();

  try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Ошибка чтения таблицы:", error);
    res.status(500).json({ error: error.message });
  }
});

// Вспомогательные функции для связи записей по названиям из форм Vue.
async function findId(client, table, column, value) {
  const allowed = {
    trading_object: "name",
    trading_area: "room_number",
    tenant: "organization_name",
    employee: "last_name",
    rental_contract: "contract_number",
  };

  if (allowed[table] !== column) {
    throw new Error("Недопустимое поле поиска.");
  }

  const result = await client.query(
    `SELECT id FROM ${table} WHERE ${column} = $1 ORDER BY id LIMIT 1`,
    [value],
  );

  if (!result.rows[0]) {
    throw new Error(`Не найдена запись «${value}» в ${table}.`);
  }

  return result.rows[0].id;
}

function numberValue(value) {
  const parsed = Number(
    String(value ?? "")
      .replace(/[^0-9,.-]/g, "")
      .replace(",", "."),
  );

  if (!Number.isFinite(parsed)) {
    throw new Error(`Некорректное числовое значение: ${value}`);
  }

  return parsed;
}

function floorValue(value) {
  const parsed = parseInt(
    String(value ?? "").replace(/[^0-9-]/g, ""),
    10,
  );

  if (!Number.isInteger(parsed)) {
    throw new Error(`Некорректный этаж: ${value}`);
  }

  return parsed;
}

function splitFullName(value = "") {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);

  return {
    first_name: parts[0] || "",
    last_name: parts[1] || "",
    middle_name: parts.slice(2).join(" "),
  };
}

async function buildInsert(client, section, data) {
  switch (section) {
    case "objects":
      return client.query(
        `INSERT INTO trading_object (name, address)
         VALUES ($1,$2) RETURNING id`,
        [data.name, data.address],
      );

    case "areas": {
      const objectId = await findId(
        client,
        "trading_object",
        "name",
        data.object,
      );

      return client.query(
        `INSERT INTO trading_area
         (object_id, room_number, area, floor, purpose, cost, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          objectId,
          data.name,
          numberValue(data.area),
          floorValue(data.floor),
          data.purpose,
          numberValue(data.cost),
          data.status,
        ],
      );
    }

    case "tenants": {
      const type = data.status || "Физическое лицо";

      const nameParts = splitFullName(
        type === "Юридическое лицо" ? data.contact : data.name,
      );

      return client.query(
        `INSERT INTO tenant
         (type, first_name, last_name, middle_name, organization_name,
          inn, email, address, phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          type,
          nameParts.first_name,
          nameParts.last_name,
          nameParts.middle_name,
          type === "Юридическое лицо" ? data.name : null,
          data.inn || null,
          data.email || null,
          data.address || null,
          data.phone || null,
        ],
      );
    }

    case "employees": {
      const n = splitFullName(data.name);

      return client.query(
        `INSERT INTO employee
         (first_name, last_name, middle_name, position, email, phone)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          n.first_name,
          n.last_name,
          n.middle_name,
          data.position,
          data.email || null,
          data.phone || null,
        ],
      );
    }

    case "contracts": {
      const areaId = await findId(
        client,
        "trading_area",
        "room_number",
        data.room,
      );

      const tenantResult = await client.query(
        `SELECT id FROM tenant
         WHERE organization_name = $1
         OR CONCAT_WS(' ', first_name, last_name, middle_name) = $1
         ORDER BY id LIMIT 1`,
        [data.tenant],
      );

      if (!tenantResult.rows[0]) {
        throw new Error(`Арендатор «${data.tenant}» не найден.`);
      }

      const employeeResult = await client.query(
        `SELECT id FROM employee
         WHERE CONCAT_WS(' ', first_name, last_name, middle_name) = $1
         ORDER BY id LIMIT 1`,
        [data.employee],
      );

      if (!employeeResult.rows[0]) {
        throw new Error(`Сотрудник «${data.employee}» не найден.`);
      }

      return client.query(
        `INSERT INTO rental_contract
         (contract_number, area_id, tenant_id, employee_id,
          signing_date, start_date, end_date, cost, status)
         VALUES ($1,$2,$3,$4,CURRENT_DATE,$5,$6,$7,$8) RETURNING id`,
        [
          data.name,
          areaId,
          tenantResult.rows[0].id,
          employeeResult.rows[0].id,
          data.startDate,
          data.endDate,
          numberValue(data.monthlyCost),
          data.status,
        ],
      );
    }

    case "payments": {
      const contractId = await findId(
        client,
        "rental_contract",
        "contract_number",
        data.name,
      );

      return client.query(
        `INSERT INTO rental_payment
         (contract_id, amount, status, period, payment_date)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [
          contractId,
          numberValue(data.amount),
          data.status,
          data.period,
          data.paymentDate || null,
        ],
      );
    }

    default:
      throw new Error("Неизвестный раздел.");
  }
}

async function buildUpdate(client, section, id, data) {
  // Обновление выполняется теми же полями формы, что и добавление.
  // Для связей используем идентификаторы найденных записей.
  switch (section) {
    case "objects":
      return client.query(
        "UPDATE trading_object SET name=$1,address=$2 WHERE id=$3",
        [data.name, data.address, id],
      );

    case "areas": {
      const objectId = await findId(
        client,
        "trading_object",
        "name",
        data.object,
      );

      return client.query(
        `UPDATE trading_area SET object_id=$1,room_number=$2,area=$3,
         floor=$4,purpose=$5,cost=$6,status=$7 WHERE id=$8`,
        [
          objectId,
          data.name,
          numberValue(data.area),
          floorValue(data.floor),
          data.purpose,
          numberValue(data.cost),
          data.status,
          id,
        ],
      );
    }

    case "tenants": {
      const type = data.status || "Физическое лицо";

      const n = splitFullName(
        type === "Юридическое лицо" ? data.contact : data.name,
      );

      return client.query(
        `UPDATE tenant SET type=$1,first_name=$2,last_name=$3,
         middle_name=$4,organization_name=$5,inn=$6,email=$7,
         address=$8,phone=$9 WHERE id=$10`,
        [
          type,
          n.first_name,
          n.last_name,
          n.middle_name,
          type === "Юридическое лицо" ? data.name : null,
          data.inn || null,
          data.email || null,
          data.address || null,
          data.phone || null,
          id,
        ],
      );
    }

    case "employees": {
      const n = splitFullName(data.name);

      return client.query(
        `UPDATE employee SET first_name=$1,last_name=$2,middle_name=$3,
         position=$4,email=$5,phone=$6 WHERE id=$7`,
        [
          n.first_name,
          n.last_name,
          n.middle_name,
          data.position,
          data.email || null,
          data.phone || null,
          id,
        ],
      );
    }

    case "contracts": {
      const areaId = await findId(
        client,
        "trading_area",
        "room_number",
        data.room,
      );

      const tenant = await client.query(
        `SELECT id FROM tenant
         WHERE organization_name=$1
         OR CONCAT_WS(' ',last_name,first_name,middle_name)=$1
         ORDER BY id LIMIT 1`,
        [data.tenant],
      );

      const employee = await client.query(
        `SELECT id FROM employee
         WHERE CONCAT_WS(' ',last_name,first_name,middle_name)=$1
         ORDER BY id LIMIT 1`,
        [data.employee],
      );

      if (!tenant.rows[0] || !employee.rows[0]) {
        throw new Error("Арендатор или сотрудник не найден.");
      }

      return client.query(
        `UPDATE rental_contract SET contract_number=$1,area_id=$2,
         tenant_id=$3,employee_id=$4,start_date=$5,end_date=$6,
         cost=$7,status=$8 WHERE id=$9`,
        [
          data.name,
          areaId,
          tenant.rows[0].id,
          employee.rows[0].id,
          data.startDate,
          data.endDate,
          numberValue(data.monthlyCost),
          data.status,
          id,
        ],
      );
    }

    case "payments": {
      const contractId = await findId(
        client,
        "rental_contract",
        "contract_number",
        data.name,
      );

      return client.query(
        `UPDATE rental_payment SET contract_id=$1,period=$2,
         amount=$3,payment_date=$4,status=$5 WHERE id=$6`,
        [
          contractId,
          data.period,
          numberValue(data.amount),
          data.paymentDate || null,
          data.status,
          id,
        ],
      );
    }

    default:
      throw new Error("Неизвестный раздел.");
  }
}

app.post("/api/:section", async (req, res) => {
  const section = req.params.section;

  if (!tableNames[section]) {
    return res.status(404).json({ error: "Раздел не найден." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await buildInsert(client, section, req.body);

    await client.query("COMMIT");

    res.status(201).json({
      id: result.rows[0].id,
      message: "Запись добавлена в БД.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ошибка добавления:", error);
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.put("/api/:section/:id", async (req, res) => {
  const { section, id } = req.params;

  if (!tableNames[section]) {
    return res.status(404).json({ error: "Раздел не найден." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await buildUpdate(
      client,
      section,
      Number(id),
      req.body,
    );

    if (!result.rowCount) {
      throw new Error("Запись не найдена.");
    }

    await client.query("COMMIT");

    res.json({ message: "Запись обновлена в БД." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ошибка обновления:", error);
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.delete("/api/:section/:id", async (req, res) => {
  const table = tableNames[req.params.section];

  if (!table) {
    return res.status(404).json({ error: "Раздел не найден." });
  }

  try {
    const result = await pool.query(
      `DELETE FROM ${table} WHERE id=$1`,
      [Number(req.params.id)],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Запись не найдена." });
    }

    res.json({ message: "Запись удалена из БД." });
  } catch (error) {
    console.error("Ошибка удаления:", error);

    res.status(409).json({
      error: "Не удалось удалить запись. Возможно, на неё ссылаются другие данные.",
    });
  }
});

app.use((req, res) =>
  res.status(404).json({ error: "Маршрут не найден." }),
);

app.listen(port, () => {
  console.log(`Сервер запущен: http://localhost:${port}`);
});
