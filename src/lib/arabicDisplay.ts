export type LookupOption = {
  id: number;
  label: string;
  [key: string]: unknown;
};

export type Lookups = {
  owners?: LookupOption[];
  properties?: LookupOption[];
  units?: LookupOption[];
  tenants?: LookupOption[];
  contracts?: LookupOption[];
  service_providers?: LookupOption[];
  owner_bank_accounts?: LookupOption[];
  expense_categories?: LookupOption[];
  users?: LookupOption[];
  [key: string]: LookupOption[] | undefined;
};

export const fieldLabels: Record<string, string> = {
  id: "الرقم",
  name: "الاسم",
  title: "العنوان",
  phone: "الجوال",
  mobile: "الجوال",
  alternate_phone: "جوال بديل",
  email: "البريد الإلكتروني",
  national_id: "رقم الهوية",
  iqama_number: "رقم الإقامة",
  nationality: "الجنسية",
  type: "النوع",
  notes: "ملاحظات",
  description: "الوصف",

  owner_id: "اسم المالك",
  property_id: "العقار",
  unit_id: "الوحدة",
  parent_unit_id: "الوحدة الرئيسية",
  tenant_id: "المستأجر",
  contract_id: "العقد",
  payment_id: "الدفعة",
  service_provider_id: "مقدم الخدمة",
  owner_bank_account_id: "حساب المالك البنكي",
  category_id: "التصنيف",
  user_id: "المستخدم",
  created_by_user_id: "أنشئ بواسطة",
  updated_by_user_id: "آخر تعديل بواسطة",
  deleted_by_user_id: "حذف بواسطة",

  city: "المدينة",
  district: "الحي",
  address: "العنوان",
  national_short_address: "العنوان الوطني المختصر",
  property_area: "مساحة العقار",
  deed_number: "رقم الصك",
  property_type: "نوع العقار",
  usage_type: "نوع الاستخدام",
  management_type: "نوع الإدارة",
  floors_count: "عدد الأدوار",
  parking_spots_count: "عدد المواقف",
  elevators_count: "عدد المصاعد",

  unit_number: "رقم الوحدة",
  floor: "الدور",
  status: "الحالة",
  rent_amount: "قيمة الإيجار",
  rooms_count: "عدد الغرف",
  bathrooms_count: "عدد دورات المياه",
  has_kitchen: "يوجد مطبخ",
  kitchen_type: "نوع المطبخ",
  is_kitchen_installed: "المطبخ مركب",
  has_living_room: "يوجد صالة",
  is_rooftop: "ملحق/سطح",
  is_subdivided: "مقسمة",
  orientation: "الاتجاه",

  amount: "المبلغ",
  due_date: "تاريخ الاستحقاق",
  paid_date: "تاريخ السداد",
  received_date: "تاريخ الاستلام",
  expense_date: "تاريخ المصروف",
  start_date: "بداية العقد",
  end_date: "نهاية العقد",
  contract_number: "رقم العقد",
  government_contract_number: "رقم العقد الحكومي",
  payment_cycle: "دورة السداد",
  parking_fee: "رسوم الموقف",
  services_fee: "رسوم الخدمات",
  deposit_amount: "مبلغ التأمين",
  reference_number: "رقم المرجع",
  method: "طريقة السداد",

  provider: "المزود",
  bill_type: "نوع الفاتورة",
  bill_number: "رقم الفاتورة",
  priority: "الأولوية",
  request_date: "تاريخ الطلب",
  scheduled_date: "تاريخ الجدولة",
  completed_date: "تاريخ الإنجاز",
  estimated_cost: "التكلفة التقديرية",
  actual_cost: "التكلفة الفعلية",

  bank_name: "اسم البنك",
  account_name: "اسم الحساب",
  iban: "IBAN",
  account_number: "رقم الحساب",
  is_active: "نشط",
  is_default: "افتراضي",
  is_preferred: "مفضل",
  provider_type: "نوع الخدمة",
  default_visit_fee: "رسوم الزيارة",
  rating: "التقييم",

  inspection_type: "نوع المعاينة",
  inspection_date: "تاريخ المعاينة",
  inspector_name: "اسم الفاحص",
  electricity_meter_reading: "قراءة عداد الكهرباء",
  water_meter_reading: "قراءة عداد الماء",
  keys_count: "عدد المفاتيح",
  damage_notes: "ملاحظات التلف",
  recommendations: "التوصيات",

  created_at: "تاريخ الإنشاء",
  updated_at: "تاريخ التحديث",
  deleted_at: "تاريخ الحذف",
};

export const resourceLabels: Record<string, string> = {
  owners: "الملاك",
  properties: "العقارات",
  units: "الوحدات",
  tenants: "المستأجرون",
  contracts: "العقود",
  payments: "الدفعات",
  payment_receipts: "سندات القبض",
  property_expenses: "مصروفات العقارات",
  utility_bills: "فواتير الخدمات",
  maintenance_requests: "طلبات الصيانة",
  document_records: "المستندات",
  follow_up_tasks: "مهام المتابعة",
  owner_payouts: "حوالات الملاك",
  owner_bank_accounts: "حسابات الملاك البنكية",
  unit_inspections: "معاينات الوحدات",
  service_providers: "مقدمو الخدمة",
};

export const valueLabels: Record<string, Record<string, string>> = {
  property_type: {
    building: "عمارة",
    apartment: "شقة مستقلة",
    villa: "فيلا",
    land: "أرض",
    shop: "محل",
    office: "مكتب",
  },
  management_type: {
    owned: "مملوك",
    managed: "إدارة للغير",
    agent: "وكيل إدارة",
  },
  usage_type: {
    residential: "سكني",
    commercial: "تجاري",
    mixed: "مختلط",
  },
  type: {
    apartment: "شقة",
    studio: "استوديو",
    room: "غرفة",
    shop: "محل",
    office: "مكتب",
    external: "مالك",
    internal: "مالك",
    owner: "مالك",
    self: "مالك",
    partner: "مالك",
    admin: "مدير",
  },
  kitchen_type: {
    closed: "مغلق",
    open: "مفتوح على الصالة",
  },
  orientation: {
    front: "أمامي",
    back: "خلفي",
    side: "جانبي",
    corner: "زاوية",
  },
  status: {
    active: "نشط",
    inactive: "غير نشط",
    available: "متاح",
    rented: "مؤجر",
    maintenance: "صيانة",
    due: "مستحق",
    paid: "مدفوع",
    overdue: "متأخر",
    partial: "جزئي",
    pending: "معلق",
    open: "مفتوح",
    completed: "مكتمل",
    needs_repair: "يحتاج إصلاح",
    cancelled: "ملغي",
    archived: "مؤرشف",
  },
  priority: {
    urgent: "طارئ",
    high: "عالي",
    normal: "عادي",
    low: "منخفض",
  },
  method: {
    cash: "نقدًا",
    bank_transfer: "تحويل بنكي",
    card: "بطاقة",
    cheque: "شيك",
    other: "أخرى",
  },
  provider_type: {
    general: "عام",
    plumbing: "سباكة",
    electricity: "كهرباء",
    ac: "مكيفات",
    cleaning: "نظافة",
    security: "حراسة",
    internet: "إنترنت",
    elevator: "مصاعد",
  },
  inspection_type: {
    periodic: "دورية",
    move_in: "استلام",
    move_out: "تسليم",
    maintenance: "صيانة",
  },
  payment_cycle: {
    monthly: "شهري",
    quarterly: "ربع سنوي",
    semi_annual: "نصف سنوي",
    annual: "سنوي",
    once: "مرة واحدة",
  },
  bill_type: {
    electricity: "كهرباء",
    water: "مياه",
    internet: "إنترنت",
    gas: "غاز",
    cleaning: "نظافة",
    elevator: "مصاعد",
    other: "أخرى",
  },
};

export const booleanFields = [
  "is_active",
  "is_default",
  "is_preferred",
  "has_kitchen",
  "is_kitchen_installed",
  "has_living_room",
  "is_rooftop",
  "is_subdivided",
  "walls_ok",
  "doors_ok",
  "windows_ok",
  "plumbing_ok",
  "electricity_ok",
  "ac_ok",
  "kitchen_ok",
  "bathrooms_ok",
  "cleanliness_ok",
];

export function labelFor(field: string) {
  return fieldLabels[field] || arabizeKey(field);
}

export function labelForResource(resource: string | null | undefined, field: string) {
  if ((resource === "properties" || resource === "property") && field === "name") {
    return "اسم العقار";
  }

  return labelFor(field);
}

export function resourceLabel(resource?: string | null) {
  if (!resource) return "-";
  return resourceLabels[resource] || arabizeKey(resource);
}

export function arabizeKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(" id", "")
    .replace("created at", "تاريخ الإنشاء")
    .replace("updated at", "تاريخ التحديث");
}

export function relationKeyForField(field: string): keyof Lookups | null {
  if (field === "owner_id") return "owners";
  if (field === "property_id") return "properties";
  if (field === "unit_id" || field === "parent_unit_id") return "units";
  if (field === "tenant_id") return "tenants";
  if (field === "contract_id") return "contracts";
  if (field === "service_provider_id") return "service_providers";
  if (field === "owner_bank_account_id") return "owner_bank_accounts";
  if (field === "category_id") return "expense_categories";
  if (field === "user_id" || field === "created_by_user_id" || field === "updated_by_user_id" || field === "deleted_by_user_id") return "users";
  return null;
}

export function isRelationField(field: string) {
  return Boolean(relationKeyForField(field)) || field.endsWith("_id");
}

export function translateValue(field: string, value: unknown, lookups: Lookups = {}) {
  if (value === null || value === undefined || value === "") return "غير محدد";

  if (typeof value === "boolean") return value ? "نعم" : "لا";

  if (booleanFields.includes(field)) {
    const stringValue = String(value);
    if (stringValue === "1" || stringValue === "true") return "نعم";
    if (stringValue === "0" || stringValue === "false") return "لا";
  }

  const relationKey = relationKeyForField(field);
  const relationOptions = relationKey ? lookups[relationKey] || [] : [];
  const relation = relationOptions.find((item) => String(item.id) === String(value));

  if (relation) return relation.label;

  if (isRelationField(field)) return "غير محدد";

  const fieldValueLabels = valueLabels[field];

  if (fieldValueLabels) {
    const translated = fieldValueLabels[String(value)];
    if (translated) return translated;
  }

  return String(value);
}

export function editableOptionFields() {
  return valueLabels;
}
