<script setup>
import { computed, ref, onMounted } from "vue";
import {
  LayoutDashboard,
  Building2,
  Store,
  Users,
  UserRoundCog,
  FileText,
  CreditCard,
  Plus,
  Search,
  Pencil,
  Eye,
  Trash2,
  X,
  Download,
  CalendarDays,
} from "lucide-vue-next";

const menu = [
  { id: "dashboard", name: "Главная", icon: LayoutDashboard },
  { id: "objects", name: "Торговые объекты", icon: Building2 },
  { id: "areas", name: "Торговые помещения", icon: Store },
  { id: "tenants", name: "Арендаторы", icon: Users },
  { id: "employees", name: "Сотрудники", icon: UserRoundCog },
  { id: "contracts", name: "Договоры аренды", icon: FileText },
  { id: "payments", name: "Платежи", icon: CreditCard },
];

const active = ref("dashboard");
const search = ref("");
const showForm = ref(false);
const editingId = ref(null);
const message = ref("");
const formValues = ref({});
const sortKey = ref("");
const sortDirection = ref(1);
const filters = ref({});
const showFilters = ref(false);

const tables = ref({
  objects: [], areas: [], tenants: [], employees: [], contracts: [], payments: [],
});
const apiBase = "http://localhost:3000/api";
const dashboardStats = ref({ objects: 0, areas: 0, activeContracts: 0, overdueContracts: 0, pendingPayments: 0 });

async function loadSection(section = active.value) {
  if (!tableConfig[section]) return;
  try {
    const response = await fetch(`${apiBase}/${section}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить данные.");
    tables.value[section] = result;
  } catch (error) {
    message.value = error.message === "Failed to fetch"
      ? "Не удалось подключиться к серверу Node.js. Запустите server.js."
      : error.message;
  }
}

async function loadDashboard() {
  try {
    const response = await fetch(`${apiBase}/dashboard`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить статистику.");
    dashboardStats.value = result;
  } catch (error) { message.value = error.message; }
}

// Столбцы и поля формы для каждого раздела.
const tableConfig = {
  objects: {
    columns: [
      { key: "id", label: "ID" },
      { key: "name", label: "Торговый объект" },
      { key: "address", label: "Адрес" },
      { key: "status", label: "Статус" },
    ],
    fields: [
      {
        key: "name",
        label: "Название торгового объекта",
        placeholder: "Например, ТЦ Сургут Сити Молл",
      },
      { key: "address", label: "Адрес", placeholder: "Введите адрес" },
      { key: "status", label: "Статус", placeholder: "Например, Активен" },
    ],
  },
  areas: {
    columns: [
      { key: "id", label: "ID" },
      { key: "name", label: "Номер помещения" },
      { key: "object", label: "Торговый объект" },
      { key: "area", label: "Площадь" },
      { key: "floor", label: "Этаж" },
      { key: "purpose", label: "Назначение" },
      { key: "cost", label: "Стоимость аренды" },
      { key: "status", label: "Статус" },
    ],
    fields: [
      {
        key: "name",
        label: "Номер помещения",
        placeholder: "Например, Помещение 101",
      },
      {
        key: "object",
        label: "Торговый объект",
        placeholder: "Введите название объекта",
      },
      { key: "area", label: "Площадь", placeholder: "Например, 45,5 м²" },
      { key: "floor", label: "Этаж", placeholder: "Например, 1 этаж" },
      {
        key: "purpose",
        label: "Назначение",
        placeholder: "Например, Магазин одежды",
      },
      {
        key: "cost",
        label: "Стоимость аренды",
        placeholder: "Например, 45 000 ₽",
      },
      { key: "status", label: "Статус", placeholder: "Например, Свободна" },
    ],
  },
  tenants: {
    columns: [
      { key: "id", label: "ID" },
      { key: "name", label: "Арендатор" },
      { key: "contact", label: "Контактное лицо" },
      { key: "inn", label: "ИНН" },
      { key: "email", label: "Электронная почта" },
      { key: "address", label: "Адрес" },
      { key: "phone", label: "Телефон" },
      { key: "status", label: "Тип лица" },
    ],
    fields: [
      {
        key: "name",
        label: "Наименование организации или ФИО",
        placeholder: "Введите наименование или ФИО",
      },
      {
        key: "contact",
        label: "Контактное лицо",
        placeholder: "ФИО контактного лица",
      },
      { key: "inn", label: "ИНН", placeholder: "Введите ИНН" },
      {
        key: "email",
        label: "Электронная почта",
        placeholder: "example@mail.ru",
      },
      { key: "address", label: "Адрес", placeholder: "Введите адрес" },
      { key: "phone", label: "Телефон", placeholder: "+79000000000" },
      {
        key: "status",
        label: "Тип лица",
        placeholder: "Юридическое лицо или Физическое лицо",
      },
    ],
  },
  employees: {
    columns: [
      { key: "id", label: "ID" },
      { key: "name", label: "ФИО сотрудника" },
      { key: "position", label: "Должность" },
      { key: "email", label: "Электронная почта" },
      { key: "phone", label: "Телефон" },
      { key: "status", label: "Статус" },
    ],
    fields: [
      { key: "name", label: "ФИО сотрудника", placeholder: "Введите ФИО" },
      { key: "position", label: "Должность", placeholder: "Введите должность" },
      {
        key: "email",
        label: "Электронная почта",
        placeholder: "example@mail.ru",
      },
      { key: "phone", label: "Телефон", placeholder: "+79000000000" },
      { key: "status", label: "Статус", placeholder: "Например, Работает" },
    ],
  },
  contracts: {
    columns: [
      { key: "id", label: "ID" },
      { key: "name", label: "Номер договора" },
      { key: "object", label: "Торговый объект" },
      { key: "room", label: "Помещение" },
      { key: "tenant", label: "Арендатор" },
      { key: "employee", label: "Ответственный сотрудник" },
      { key: "startDate", label: "Начало аренды" },
      { key: "endDate", label: "Окончание аренды" },
      { key: "monthlyCost", label: "Аренда в месяц" },
      { key: "status", label: "Статус" },
    ],
    fields: [
      {
        key: "name",
        label: "Номер договора",
        placeholder: "Например, АР-2026-011",
      },
      {
        key: "object",
        label: "Торговый объект",
        placeholder: "Введите название объекта",
      },
      {
        key: "room",
        label: "Помещение",
        placeholder: "Введите номер помещения",
      },
      { key: "tenant", label: "Арендатор", placeholder: "Введите арендатора" },
      {
        key: "employee",
        label: "Ответственный сотрудник",
        placeholder: "Введите ФИО сотрудника",
      },
      { key: "startDate", label: "Начало аренды", type: "date" },
      { key: "endDate", label: "Окончание аренды", type: "date" },
      {
        key: "monthlyCost",
        label: "Аренда в месяц",
        placeholder: "Например, 45 000 ₽",
      },
      { key: "status", label: "Статус", placeholder: "Например, Действует" },
    ],
  },
  payments: {
    columns: [
      { key: "id", label: "ID" },
      { key: "name", label: "Номер договора" },
      { key: "period", label: "Период оплаты" },
      { key: "amount", label: "Сумма" },
      { key: "paymentDate", label: "Дата платежа" },
      { key: "status", label: "Статус оплаты" },
    ],
    fields: [
      {
        key: "name",
        label: "Номер договора",
        placeholder: "Например, АР-2026-011",
      },
      {
        key: "period",
        label: "Период оплаты",
        placeholder: "Например, Июль 2026",
      },
      { key: "amount", label: "Сумма", placeholder: "Например, 45 000 ₽" },
      { key: "paymentDate", label: "Дата платежа", type: "date" },
      {
        key: "status",
        label: "Статус оплаты",
        placeholder: "Например, Оплачен",
      },
    ],
  },
};

const titles = {
  objects: "Торговые объекты",
  areas: "Торговые помещения",
  tenants: "Арендаторы",
  employees: "Сотрудники",
  contracts: "Договоры аренды",
  payments: "Платежи",
};

const addTitles = {
  objects: "Добавить торговый объект",
  areas: "Добавить торговое помещение",
  tenants: "Добавить арендатора",
  employees: "Добавить сотрудника",
  contracts: "Создать договор аренды",
  payments: "Добавить платёж",
};

const currentTitle = computed(
  () => menu.find((item) => item.id === active.value)?.name || "Главная",
);

const currentColumns = computed(() => tableConfig[active.value]?.columns || []);
const currentFields = computed(() => tableConfig[active.value]?.fields || []);

const rows = computed(() => {
  const list = tables.value[active.value] || [];
  const query = search.value.toLowerCase().trim();

  let result = list.filter((row) => {
    // Общий поиск по всем значениям строки
    const matchesSearch =
      !query ||
      Object.values(row).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query),
      );

    if (!matchesSearch) return false;

    // Фильтрация по отдельным столбцам
    const currentFilters = filters.value[active.value] || {};

    const matchesFilters = currentColumns.value.every((column) => {
      const filterValue = String(currentFilters[column.key] || "")
        .toLowerCase()
        .trim();

      if (!filterValue) return true;

      return String(row[column.key] ?? "")
        .toLowerCase()
        .includes(filterValue);
    });

    return matchesFilters;
  });

  // Сортировка
  if (sortKey.value) {
    result = [...result].sort((a, b) => {
      const first = a[sortKey.value] ?? "";
      const second = b[sortKey.value] ?? "";

      const firstNumber = Number(
        String(first)
          .replace(/[^0-9,.-]/g, "")
          .replace(",", "."),
      );

      const secondNumber = Number(
        String(second)
          .replace(/[^0-9,.-]/g, "")
          .replace(",", "."),
      );

      let comparison;

      if (
        String(first).trim() &&
        String(second).trim() &&
        Number.isFinite(firstNumber) &&
        Number.isFinite(secondNumber) &&
        /[0-9]/.test(String(first)) &&
        /[0-9]/.test(String(second))
      ) {
        comparison = firstNumber - secondNumber;
      } else {
        comparison = String(first).localeCompare(String(second), "ru", {
          numeric: true,
          sensitivity: "base",
        });
      }

      return comparison * sortDirection.value;
    });
  }

  return result;
});

function sortBy(key) {
  if (sortKey.value === key) {
    sortDirection.value *= -1;
  } else {
    sortKey.value = key;
    sortDirection.value = 1;
  }
}

function updateFilter(key, value) {
  if (!filters.value[active.value]) {
    filters.value[active.value] = {};
  }

  filters.value[active.value][key] = value;
}

function resetFilters() {
  search.value = "";
  filters.value[active.value] = {};
  showFilters.value = false;
}

function openForm() {
  editingId.value = null;
  formValues.value = {};
  for (const field of currentFields.value) {
    formValues.value[field.key] = "";
  }
  showForm.value = true;
}

async function saveForm() {
  const requiredFields = currentFields.value.filter((field) => ["name", "status"].includes(field.key));
  const missingField = requiredFields.find((field) => !String(formValues.value[field.key] || "").trim());
  if (missingField) { message.value = `Заполните поле «${missingField.label}».`; return; }
  try {
    const isEditing = editingId.value !== null;
    const url = isEditing ? `${apiBase}/${active.value}/${editingId.value}` : `${apiBase}/${active.value}`;
    const response = await fetch(url, {
      method: isEditing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formValues.value),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось сохранить запись.");
    showForm.value = false; editingId.value = null;
    message.value = result.message || "Изменения сохранены в PostgreSQL.";
    await loadSection(active.value); await loadDashboard();
  } catch (error) {
    message.value = error.message === "Failed to fetch" ? "Не удалось подключиться к серверу Node.js." : error.message;
  }
}

async function rowAction(action, row) {
  if (action === "Удаление") {
    if (!confirm(`Удалить запись «${row.name}» из базы данных?`)) return;
    try {
      const response = await fetch(`${apiBase}/${active.value}/${row.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось удалить запись.");
      message.value = result.message; await loadSection(active.value); await loadDashboard();
    } catch (error) { message.value = error.message; }
    return;
  }
  if (action === "Редактирование") {
    editingId.value = row.id; formValues.value = {};
    for (const field of currentFields.value) formValues.value[field.key] = row[field.key] ?? "";
    showForm.value = true; return;
  }
  message.value = `${row.name || row.id}: запись из PostgreSQL.`;
}

function navigate(id) {
  active.value = id;
  search.value = "";
  sortKey.value = "";
  sortDirection.value = 1;
  message.value = "";
  if (id === "dashboard") loadDashboard();
  else loadSection(id);
}
onMounted(() => { loadDashboard(); loadSection("objects"); });
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-icon"><Building2 :size="25" /></div>
        <div>
          <strong>RentSpace</strong>
          <small>УПРАВЛЕНИЕ АРЕНДОЙ</small>
        </div>
      </div>

      <p class="menu-caption">ГЛАВНОЕ МЕНЮ</p>

      <nav>
        <button
          v-for="item in menu"
          :key="item.id"
          class="nav-item"
          :class="{ active: active === item.id }"
          @click="navigate(item.id)"
        >
          <component :is="item.icon" :size="19" />
          <span>{{ item.name }}</span>
        </button>
      </nav>

      <div class="sidebar-bottom">
        <div class="avatar">МС</div>
        <div>
          <strong>Мария Соколова</strong>
          <small>Администратор</small>
        </div>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="breadcrumb">Рабочее пространство / {{ currentTitle }}</div>
        <div class="today"><CalendarDays :size="16" /> 29 октября 2026</div>
      </header>

      <div class="content">
        <section v-if="active === 'dashboard'">
          <div class="heading">
            <div>
              <p class="eyebrow">ОБЗОР СИСТЕМЫ</p>
              <h1>Главная</h1>
              <p class="subtitle">
                Общая информация об аренде торговых площадей.
              </p>
            </div>
            <button class="primary" @click="navigate('contracts')">
              <FileText :size="17" /> Договоры аренды
            </button>
          </div>

          <div class="stats">
            <article class="stat-card">
              <span>Торговые объекты</span>
              <strong>{{ dashboardStats.objects }}</strong>
              <small>Объекты в системе</small>
            </article>
            <article class="stat-card">
              <span>Торговые помещения</span>
              <strong>{{ dashboardStats.areas }}</strong>
              <small>Все помещения в системе</small>
            </article>
            <article class="stat-card">
              <span>Действующие договоры</span>
              <strong>
                {{
                  dashboardStats.activeContracts
                }}
              </strong>

              <strong style="color: red">
                {{
                  dashboardStats.overdueContracts
                }}
              </strong>
              <small>Договоры аренды</small>
            </article>
            <article class="stat-card">
              <span>Ожидают оплаты</span>
              <strong>{{
                dashboardStats.pendingPayments
              }}</strong>
              <small>Платежи по договорам</small>
            </article>
          </div>

          <div class="columns">
            <article class="panel">
              <h2>Быстрый переход</h2>
              <p class="muted">Выберите нужный раздел системы.</p>
              <div class="shortcut-list">
                <button @click="navigate('objects')">
                  <Building2 /> Торговые объекты
                </button>
                <button @click="navigate('areas')">
                  <Store /> Торговые помещения
                </button>
                <button @click="navigate('tenants')">
                  <Users /> Арендаторы
                </button>
                <button @click="navigate('contracts')">
                  <FileText /> Договоры аренды
                </button>
                <button @click="navigate('payments')">
                  <CreditCard /> Платежи
                </button>
              </div>
            </article>

            <article class="panel">
              <h2>Состояние системы</h2>
              <div class="summary-row">
                <span>Арендовано помещений</span><strong>83,5%</strong>
              </div>
              <div class="progress"><div style="width: 83.5%"></div></div>
              <div class="summary-row">
                <span>Свободно помещений</span><strong>11,7%</strong>
              </div>
              <div class="progress"><div style="width: 11.7%"></div></div>
              <div class="summary-row">
                <span>На согласовании</span><strong>4,8%</strong>
              </div>
              <div class="progress"><div style="width: 4.8%"></div></div>
              <div class="notice">
                Данные приведены для демонстрации пользовательского интерфейса.
              </div>
            </article>
          </div>
        </section>

        <section v-else>
          <div class="heading">
            <div>
              <p class="eyebrow">УПРАВЛЕНИЕ ДАННЫМИ</p>
              <h1>{{ titles[active] }}</h1>
              <p class="subtitle">
                Просмотр и управление данными PostgreSQL.
              </p>
            </div>
            <button class="primary" @click="openForm">
              <Plus :size="17" /> {{ addTitles[active] }}
            </button>
          </div>

          <div class="toolbar">
            <div class="search-box">
              <Search :size="18" />
              <input v-model="search" placeholder="Поиск по таблице..." />
            </div>

            <button class="secondary" @click="showFilters = !showFilters">
              Фильтры
            </button>

            <button class="secondary" @click="resetFilters">
              Сбросить фильтры
            </button>

            <button
              class="secondary"
              @click="
                message = 'Экспорт не реализован в рамках лабораторной работы.'
              "
            >
              <Download :size="16" /> Экспорт
            </button>
          </div>
          <div class="panel table-panel">
            <div v-if="showFilters" class="panel filter-panel">
              <h3>Фильтрация записей</h3>

              <div class="filter-grid">
                <label
                  v-for="column in currentColumns"
                  :key="column.key"
                  class="filter-field"
                >
                  {{ column.label }}

                  <select
                    v-if="column.key === 'status'"
                    :value="filters[active]?.[column.key] || ''"
                    @change="updateFilter(column.key, $event.target.value)"
                  >
                    <option value="">Все значения</option>
                    <option
                      v-for="value in [
                        ...new Set(
                          (tables[active] || [])
                            .map((row) => row[column.key])
                            .filter(Boolean),
                        ),
                      ]"
                      :key="value"
                      :value="value"
                    >
                      {{ value }}
                    </option>
                  </select>

                  <input
                    v-else
                    type="text"
                    :value="filters[active]?.[column.key] || ''"
                    placeholder="Введите значение"
                    @input="updateFilter(column.key, $event.target.value)"
                  />
                </label>
              </div>

              <p class="muted">Найдено записей: {{ rows.length }}</p>
            </div>
          </div>

          <div class="panel table-panel">
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th
                      v-for="column in currentColumns"
                      :key="column.key"
                      class="sortable"
                      @click="sortBy(column.key)"
                    >
                      {{ column.label }}
                      <span v-if="sortKey === column.key">
                        {{ sortDirection === 1 ? "↑" : "↓" }}
                      </span>
                    </th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in rows" :key="row.id">
                    <td v-for="column in currentColumns" :key="column.key">
                      <strong v-if="column.key === 'name'">{{
                        row[column.key] || "—"
                      }}</strong>
                      <span
                        v-else-if="column.key === 'status'"
                        class="status"
                        :class="{
                          active: [
                            'Действует',
                            'Активен',
                            'Работает',
                            'Оплачен',
                          ].includes(row.status),
                          expired: ['Просрочен'].includes(row.status),
                          free: ['Свободна', 'Ожидает оплаты'].includes(
                            row.status,
                          ),
                        }"
                      >
                        {{ row[column.key] || "—" }}
                      </span>
                      <span v-else>{{ row[column.key] || "—" }}</span>
                    </td>
                    <td class="actions">
                      <button
                        title="Просмотр"
                        @click="rowAction('Просмотр', row)"
                      >
                        <Eye :size="16" />
                      </button>
                      <button
                        title="Редактирование"
                        @click="rowAction('Редактирование', row)"
                      >
                        <Pencil :size="16" />
                      </button>
                      <button
                        title="Удаление"
                        @click="rowAction('Удаление', row)"
                      >
                        <Trash2 :size="16" />
                      </button>
                    </td>
                  </tr>
                  <tr v-if="rows.length === 0">
                    <td :colspan="currentColumns.length + 1" class="empty">
                      Записи не найдены.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="table-footer">
              Количество записей: {{ rows.length }}
            </div>
          </div>
        </section>

        <div v-if="message" class="message">
          <span>{{ message }}</span>
          <button @click="message = ''"><X :size="16" /></button>
        </div>

        <footer>
          RentSpace · Система управления арендой · PostgreSQL
        </footer>
      </div>
    </main>

    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="modal">
        <div class="modal-heading">
          <div>
            <p class="eyebrow">ФОРМА ВВОДА ДАННЫХ</p>
            <h2>{{ editingId !== null ? "Редактировать запись" : addTitles[active] }}</h2>
          </div>
          <button class="close" @click="showForm = false"><X /></button>
        </div>
        <label v-for="field in currentFields" :key="field.key">
          {{ field.label }}
          <input
            v-model="formValues[field.key]"
            :type="field.type || 'text'"
            :placeholder="field.placeholder || 'Введите значение'"
          />
        </label>
        <div class="modal-actions">
          <button class="secondary" @click="showForm = false">Отмена</button>
          <button class="primary" @click="saveForm">Сохранить</button>
        </div>
        <p class="modal-note">
          Поля соответствуют выбранному разделу. Запись сохраняется непосредственно в PostgreSQL.
        </p>
      </div>
    </div>
  </div>
</template>

<style>
th.sortable {
  cursor: pointer;
  user-select: none;
}

th.sortable:hover {
  opacity: 0.75;
}
</style>
