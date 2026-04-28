// main.js - العمود الفقري للنظام المحاسبي (نسخة SQLite متكاملة ومعدلة)
console.log('🚀 تهيئة النظام المحاسبي...');

// ======================== 1. إعداد SQL.js ========================
let db;
let SQL;

// عنصر عرض المحتوى
const content = document.getElementById('content');

// تحميل بيانات الشركة من localStorage (إعدادات فقط)
let company = JSON.parse(localStorage.getItem('company')) || {
    name: 'متجر المدخلات الزراعية',
    phone: '777777777',
    address: 'اليمن - صنعاء',
    logo: '',
    stamp: ''
};

function saveCompany() {
    localStorage.setItem('company', JSON.stringify(company));
}

// سجل العمليات
let systemLogs = JSON.parse(localStorage.getItem('systemLogs')) || [];

function addLog(action, details) {
    systemLogs.push({
        date: new Date().toLocaleString(),
        action: action,
        details: details,
        user: currentUser ? currentUser.username : ''
    });
    localStorage.setItem('systemLogs', JSON.stringify(systemLogs));
}

// المستخدمون (مع تشفير)
let users = JSON.parse(localStorage.getItem('users')) || [
    { username: 'admin', password: '282d0a3502ab22e0aef653cd70a2b1e1dc1a51fe412bd6feea768fdfaf550f18', role: 'admin' }
];
let currentUser = JSON.parse(sessionStorage.getItem('currentUser')) || null;

// إعدادات عامة
let settings = JSON.parse(localStorage.getItem('settings')) || {
    storeName: 'متجر المدخلات الزراعية',
    currency: 'YER'
};

let currencies = JSON.parse(localStorage.getItem('currencies')) || [
    { id: 1, code: 'YER', name: 'ريال يمني', symbol: 'ر.ي', rate: 1, default: true },
    { id: 2, code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', rate: 140, default: false },
    { id: 3, code: 'USD', name: 'دولار أمريكي', symbol: '$', rate: 530, default: false }
];

// قائمة الصلاحيات
const allPermissions = [
    'manage_users', 'manage_settings',
    'manage_accounts', 'edit_accounts', 'delete_accounts',
    'manage_products', 'edit_products', 'delete_products',
    'manage_partners', 'edit_partners', 'delete_partners',
    'manage_sales', 'edit_sales', 'delete_sales',
    'manage_purchases', 'edit_purchases', 'delete_purchases',
    'manage_vouchers', 'edit_vouchers', 'delete_vouchers',
    'manage_journal', 'edit_journal', 'delete_journal',
    'view_reports', 'backup_restore', 'reset_system'
];

function hasPermission(perm) {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.permissions && currentUser.permissions.includes(perm);
}

function secureAccess(pageFunc, permission = null) {
    if (!currentUser) { loginPage(); return; }
    if (permission && !hasPermission(permission)) { alert('⛔ غير مصرح لك بالوصول إلى هذه الميزة.'); return; }
    pageFunc();
}

// ======================== 2. تهيئة قاعدة البيانات ========================
async function initDatabase() {
    if (typeof initSqlJs === 'undefined') {
        console.error('❌ مكتبة sql.js غير محملة.');
        content.innerHTML = '<div class="card"><h3>خطأ</h3><p>مكتبة قاعدة البيانات غير محملة.</p></div>';
        return;
    }

    SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });

    const savedDB = localStorage.getItem('accounting_db');
    if (savedDB) {
        const arr = new Uint8Array(JSON.parse(savedDB));
        db = new SQL.Database(arr);
        console.log('✅ تم تحميل قاعدة البيانات المحفوظة.');
        ensureAllSchemas();
        ensureDefaultAccounts();
    } else {
        db = new SQL.Database();
        console.log('🆕 إنشاء قاعدة بيانات جديدة.');
        createAllTables();
        insertDefaultData();
        if (typeof initAccounts === 'function') initAccounts();
    }

    saveDatabase();
}

function saveDatabase() {
    if (db) {
        const arr = Array.from(db.export());
        localStorage.setItem('accounting_db', JSON.stringify(arr));
    }
}

// ======================== دوال مساعدة للاستعلام ========================
function query(sql, params = []) {
    try {
        const res = db.exec(sql, params);
        return res.length ? res[0].values : [];
    } catch (e) {
        console.error('Query Error:', e, sql);
        return [];
    }
}

function run(sql, params = []) {
    try {
        db.run(sql, params);
        saveDatabase();
        return { changes: db.getRowsModified() };
    } catch (e) {
        console.error('Run Error:', e, sql);
        return { error: e.message };
    }
}

// ======================== 3. إنشاء جميع الجداول ========================
function createAllTables() {
    // الحسابات
    db.run(`CREATE TABLE IF NOT EXISTS chart_of_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('Asset','Liability','Equity','Revenue','Expense')),
        parent_id INTEGER,
        current_balance REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(parent_id) REFERENCES chart_of_accounts(id)
    )`);

    // الفترات المالية
    db.run(`CREATE TABLE IF NOT EXISTS fiscal_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT DEFAULT 'Open' CHECK(status IN ('Open','Closed','Locked'))
    )`);

    // وحدات القياس
    db.run(`CREATE TABLE IF NOT EXISTS units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )`);

    // فئات الأصناف
    db.run(`CREATE TABLE IF NOT EXISTS item_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )`);

    // الأصناف
    db.run(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        barcode TEXT,
        unit_id INTEGER,
        category_id INTEGER,
        purchase_cost REAL DEFAULT 0,
        sales_price REAL DEFAULT 0,
        currency TEXT DEFAULT 'YER',
        notes TEXT,
        current_stock REAL DEFAULT 0,
        reorder_level REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY(unit_id) REFERENCES units(id),
        FOREIGN KEY(category_id) REFERENCES item_categories(id)
    )`);

    // العملاء والموردين
    db.run(`CREATE TABLE IF NOT EXISTS partners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('Customer','Supplier','Both')),
        account_id INTEGER,
        phone TEXT,
        email TEXT,
        address TEXT,
        city TEXT,
        tax_id TEXT,
        credit_limit REAL DEFAULT 0,
        current_balance REAL DEFAULT 0,
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY(account_id) REFERENCES chart_of_accounts(id)
    )`);

    // القيود المحاسبية
    db.run(`CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_number TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        ref TEXT,
        currency_id INTEGER,
        period_id INTEGER,
        entry_type TEXT DEFAULT 'daily',
        amount_words TEXT,
        status TEXT DEFAULT 'Draft' CHECK(status IN ('Draft','Posted','Reversed')),
        auto_generated INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(period_id) REFERENCES fiscal_periods(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS journal_entry_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        description TEXT,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        FOREIGN KEY(entry_id) REFERENCES journal_entries(id),
        FOREIGN KEY(account_id) REFERENCES chart_of_accounts(id)
    )`);

    // فواتير المبيعات
    db.run(`CREATE TABLE IF NOT EXISTS sales_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        customer_id INTEGER,
        total REAL DEFAULT 0,
        currency TEXT DEFAULT 'YER',
        ref TEXT,
        type TEXT DEFAULT 'cash',
        status TEXT DEFAULT 'Draft',
        journal_entry_id INTEGER,
        FOREIGN KEY(customer_id) REFERENCES partners(id),
        FOREIGN KEY(journal_entry_id) REFERENCES journal_entries(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sales_invoice_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        line_total REAL NOT NULL,
        FOREIGN KEY(invoice_id) REFERENCES sales_invoices(id),
        FOREIGN KEY(item_id) REFERENCES items(id)
    )`);

    // عروض الأسعار
    db.run(`CREATE TABLE IF NOT EXISTS quotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_number TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        customer_id INTEGER,
        ref TEXT,
        total REAL DEFAULT 0,
        converted INTEGER DEFAULT 0,
        FOREIGN KEY(customer_id) REFERENCES partners(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS quotation_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        line_total REAL NOT NULL,
        FOREIGN KEY(quote_id) REFERENCES quotations(id),
        FOREIGN KEY(item_id) REFERENCES items(id)
    )`);

    // مرتجعات المبيعات
    db.run(`CREATE TABLE IF NOT EXISTS sales_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        customer_id INTEGER,
        total REAL DEFAULT 0,
        currency TEXT DEFAULT 'YER',
        ref TEXT,
        status TEXT DEFAULT 'Draft',
        journal_entry_id INTEGER,
        FOREIGN KEY(customer_id) REFERENCES partners(id),
        FOREIGN KEY(journal_entry_id) REFERENCES journal_entries(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sales_return_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        line_total REAL NOT NULL,
        FOREIGN KEY(return_id) REFERENCES sales_returns(id),
        FOREIGN KEY(item_id) REFERENCES items(id)
    )`);

    // فواتير المشتريات
    db.run(`CREATE TABLE IF NOT EXISTS purchase_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        supplier_id INTEGER,
        total REAL DEFAULT 0,
        currency TEXT DEFAULT 'YER',
        ref TEXT,
        type TEXT DEFAULT 'cash',
        status TEXT DEFAULT 'Draft',
        journal_entry_id INTEGER,
        FOREIGN KEY(supplier_id) REFERENCES partners(id),
        FOREIGN KEY(journal_entry_id) REFERENCES journal_entries(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        line_total REAL NOT NULL,
        FOREIGN KEY(invoice_id) REFERENCES purchase_invoices(id),
        FOREIGN KEY(item_id) REFERENCES items(id)
    )`);

    // مرتجعات المشتريات
    db.run(`CREATE TABLE IF NOT EXISTS purchase_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        supplier_id INTEGER,
        total REAL DEFAULT 0,
        currency TEXT DEFAULT 'YER',
        ref TEXT,
        status TEXT DEFAULT 'Draft',
        journal_entry_id INTEGER,
        FOREIGN KEY(supplier_id) REFERENCES partners(id),
        FOREIGN KEY(journal_entry_id) REFERENCES journal_entries(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS purchase_return_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        line_total REAL NOT NULL,
        FOREIGN KEY(return_id) REFERENCES purchase_returns(id),
        FOREIGN KEY(item_id) REFERENCES items(id)
    )`);

    // السندات
    db.run(`CREATE TABLE IF NOT EXISTS vouchers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_number TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        voucher_type TEXT CHECK(voucher_type IN ('Receipt','Payment','Advance','Settlement')),
        account_id INTEGER,
        cash_account_id INTEGER,
        debit_account_id INTEGER,
        credit_account_id INTEGER,
        partner_id INTEGER,
        amount REAL DEFAULT 0,
        currency_id INTEGER,
        amount_words TEXT,
        description TEXT,
        ref TEXT,
        advance_type TEXT,
        status TEXT DEFAULT 'Draft',
        journal_entry_id INTEGER,
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY(partner_id) REFERENCES partners(id),
        FOREIGN KEY(journal_entry_id) REFERENCES journal_entries(id)
    )`);

    // الصناديق
    db.run(`CREATE TABLE IF NOT EXISTS cash_boxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        account_id INTEGER NOT NULL,
        currency_id INTEGER DEFAULT 1,
        opening_balance REAL DEFAULT 0,
        notes TEXT,
        deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(account_id) REFERENCES chart_of_accounts(id)
    )`);

    console.log('✅ تم إنشاء جميع الجداول.');
}

function insertDefaultData() {
    db.run("INSERT OR IGNORE INTO units (name) VALUES ('قطعة'), ('كيلوغرام'), ('متر'), ('لتر')");
    db.run("INSERT OR IGNORE INTO item_categories (name) VALUES ('عام'), ('بذور'), ('أسمدة'), ('مبيدات')");
    db.run("INSERT OR IGNORE INTO fiscal_periods (name, start_date, end_date, status) VALUES ('2026', '2026-01-01', '2026-12-31', 'Open')");
}

// ======================== دوال التأكد من المخططات ========================
function ensureAllSchemas() {
    ensureJournalSchema();
    ensureVoucherSchema();
    ensureCashSchema();
    ensureItemsSchema();
}

function ensureJournalSchema() {
    const stmts = [
        "ALTER TABLE journal_entries ADD COLUMN ref TEXT",
        "ALTER TABLE journal_entries ADD COLUMN currency_id INTEGER",
        "ALTER TABLE journal_entries ADD COLUMN entry_type TEXT DEFAULT 'daily'",
        "ALTER TABLE journal_entries ADD COLUMN amount_words TEXT"
    ];
    stmts.forEach(sql => { try { db.exec(sql); } catch (e) {} });
    try { db.exec("UPDATE journal_entries SET entry_type = 'daily' WHERE entry_type IS NULL"); } catch(e) {}
}

function ensureVoucherSchema() {
    const stmts = [
        "ALTER TABLE vouchers ADD COLUMN voucher_type TEXT DEFAULT 'Receipt'",
        "ALTER TABLE vouchers ADD COLUMN account_id INTEGER",
        "ALTER TABLE vouchers ADD COLUMN cash_account_id INTEGER",
        "ALTER TABLE vouchers ADD COLUMN debit_account_id INTEGER",
        "ALTER TABLE vouchers ADD COLUMN credit_account_id INTEGER",
        "ALTER TABLE vouchers ADD COLUMN advance_type TEXT",
        "ALTER TABLE vouchers ADD COLUMN deleted INTEGER DEFAULT 0"
    ];
    stmts.forEach(sql => { try { db.exec(sql); } catch (e) {} });
}

function ensureCashSchema() {
    try { db.exec("CREATE TABLE IF NOT EXISTS cash_boxes (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT UNIQUE, name TEXT, account_id INTEGER, currency_id INTEGER, opening_balance REAL, notes TEXT, deleted INTEGER DEFAULT 0)"); } catch(e) {}
}

function ensureItemsSchema() {
    const stmts = [
        "ALTER TABLE items ADD COLUMN average_cost REAL DEFAULT 0",
        "ALTER TABLE items ADD COLUMN purchase_cost REAL DEFAULT 0",
        "ALTER TABLE sales_returns ADD COLUMN type TEXT DEFAULT 'cash'"
    ];
    stmts.forEach(sql => { try { db.exec(sql); } catch (e) {} });
}

function ensureDefaultAccounts() {
    const count = query('SELECT COUNT(*) FROM chart_of_accounts')[0][0];
    if (count === 0 && typeof initAccounts === 'function') {
        initAccounts();
    }
}

// ======================== دالة تحديث رصيد الحساب (عامة) ========================
window.updateAccountBalance = function(accountId, amount, type) {
    if (!accountId || amount <= 0) return;
    
    const account = query(`SELECT type FROM chart_of_accounts WHERE id = ?`, [accountId])[0];
    if (!account) return;
    
    let delta = 0;
    const accType = account[0];
    
    if (type === 'debit') {
        if (accType === 'Asset' || accType === 'Expense') delta = amount;
        else delta = -amount;
    } else if (type === 'credit') {
        if (accType === 'Liability' || accType === 'Equity' || accType === 'Revenue') delta = amount;
        else delta = -amount;
    }
    
    if (delta !== 0) {
        run(`UPDATE chart_of_accounts SET current_balance = current_balance + ? WHERE id = ?`, [delta, accountId]);
        saveDatabase();
    }
};

// ======================== دوال مساعدة عامة ========================
function today() {
    return new Date().toISOString().slice(0, 10);
}

function now() {
    return new Date().toLocaleString();
}

function formatMoney(amount) {
    return Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCurrencyName(id) {
    const c = currencies.find(c => c.id == id);
    return c ? c.symbol : '';
}

function getCurrencyOptions(selectedId = null) {
    if (!selectedId) {
        const def = currencies.find(c => c.default);
        selectedId = def ? def.id : 1;
    }
    return currencies.map(c => `<option value="${c.id}" ${c.id == selectedId ? 'selected' : ''}>${c.name}</option>`).join('');
}

function numberToArabicWords(num) {
    if (isNaN(num)) return '';
    if (num === 0) return 'صفر';
    
    const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
    
    function convertLessThanThousand(n) {
        if (n === 0) return '';
        if (n < 10) return units[n];
        if (n < 20) return teens[n - 10];
        if (n < 100) {
            const unit = n % 10;
            const ten = Math.floor(n / 10);
            return unit === 0 ? tens[ten] : `${units[unit]} و${tens[ten]}`;
        }
        const hundred = Math.floor(n / 100);
        const remainder = n % 100;
        const hundredText = hundreds[hundred];
        const remainderText = convertLessThanThousand(remainder);
        return remainder === 0 ? hundredText : `${hundredText} و${remainderText}`;
    }
    
    let result = '';
    let remaining = Math.floor(Math.abs(num));
    
    if (remaining >= 1000000) {
        const millions = Math.floor(remaining / 1000000);
        result += (millions === 1 ? 'مليون' : (millions === 2 ? 'مليونان' : convertLessThanThousand(millions) + ' ملايين')) + ' ';
        remaining %= 1000000;
    }
    if (remaining >= 1000) {
        const thousands = Math.floor(remaining / 1000);
        result += (thousands === 1 ? 'ألف' : (thousands === 2 ? 'ألفان' : convertLessThanThousand(thousands) + ' آلاف')) + ' ';
        remaining %= 1000;
    }
    if (remaining > 0) {
        result += convertLessThanThousand(remaining);
    }
    
    return result.trim() + ' ريال';
}

// ======================== واجهات الصفحات ========================
function dashboard() {
    const accCount = query('SELECT COUNT(*) FROM chart_of_accounts WHERE is_active = 1')[0][0];
    const custCount = query("SELECT COUNT(*) FROM partners WHERE type IN ('Customer','Both') AND deleted = 0")[0][0];
    const suppCount = query("SELECT COUNT(*) FROM partners WHERE type IN ('Supplier','Both') AND deleted = 0")[0][0];
    const itemCount = query('SELECT COUNT(*) FROM items WHERE is_active = 1')[0][0];

    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-tachometer-alt"></i> لوحة التحكم</h2>
            <hr>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap:15px;">
                <div class="card"><h4>الحسابات</h4><h2>${accCount}</h2></div>
                <div class="card"><h4>العملاء</h4><h2>${custCount}</h2></div>
                <div class="card"><h4>الموردين</h4><h2>${suppCount}</h2></div>
                <div class="card"><h4>الأصناف</h4><h2>${itemCount}</h2></div>
            </div>
        </div>
    `;
}

function productsPage() { content.innerHTML = '<div class="card"><h3>الأصناف</h3><p>تحميل...</p></div>'; if (typeof initProducts === 'function') initProducts(); }
function customersPage() { content.innerHTML = '<div class="card"><h3>العملاء</h3><p>تحميل...</p></div>'; if (typeof initCustomers === 'function') initCustomers(); }
function suppliersPage() { content.innerHTML = '<div class="card"><h3>الموردين</h3><p>تحميل...</p></div>'; if (typeof initSuppliers === 'function') initSuppliers(); }
function accountsPage() { content.innerHTML = '<div class="card"><h3>الحسابات</h3><p>تحميل...</p></div>'; if (typeof initAccounts === 'function') initAccounts(); }
function salesPage() { content.innerHTML = '<div class="card"><h3>المبيعات</h3><p>تحميل...</p></div>'; if (typeof initSales === 'function') initSales(); }
function purchasesPage() { content.innerHTML = '<div class="card"><h3>المشتريات</h3><p>تحميل...</p></div>'; if (typeof initPurchases === 'function') initPurchases(); }
function stockPage() { content.innerHTML = '<div class="card"><h3>المخزون</h3><p>تحميل...</p></div>'; if (typeof initStock === 'function') initStock(); }
function cashPage() { content.innerHTML = '<div class="card"><h3>الصندوق</h3><p>تحميل...</p></div>'; if (typeof initCash === 'function') initCash(); }
function journalPage() { content.innerHTML = '<div class="card"><h3>دفتر اليومية</h3><p>تحميل...</p></div>'; if (typeof initJournal === 'function') initJournal(); }
function vouchersPage() { content.innerHTML = '<div class="card"><h3>السندات</h3><p>تحميل...</p></div>'; if (typeof initVouchers === 'function') initVouchers(); }
function lowStockPage() { content.innerHTML = '<div class="card"><h3>تنبيهات المخزون</h3><p>تحميل...</p></div>'; if (typeof initLowStock === 'function') initLowStock(); }

function companySettings() {
    content.innerHTML = `
        <div class="card">
            <h2>بيانات الشركة</h2>
            <label>اسم الشركة</label><input id="cName" class="form-control" value="${company.name}">
            <label>الهاتف</label><input id="cPhone" class="form-control" value="${company.phone}">
            <label>العنوان</label><input id="cAddress" class="form-control" value="${company.address}">
            <button onclick="saveCompanyData()">حفظ</button>
        </div>
    `;
}

function saveCompanyData() {
    company.name = document.getElementById('cName').value;
    company.phone = document.getElementById('cPhone').value;
    company.address = document.getElementById('cAddress').value;
    saveCompany();
    alert('تم الحفظ');
}

function currencyRatesPage() {
    let html = '<div class="card"><h2>أسعار الصرف</h2><table><tr><th>العملة</th><th>السعر</th><th>حفظ</th></tr>';
    currencies.forEach(c => {
        html += `<tr><td>${c.name}</td><td><input id="rate_${c.id}" type="number" value="${c.rate}"></td>
            <td><button onclick="saveCurrencyRate(${c.id})">حفظ</button></td></tr>`;
    });
    html += '</table></div>';
    content.innerHTML = html;
}

function saveCurrencyRate(id) {
    const rate = parseFloat(document.getElementById(`rate_${id}`).value);
    const currency = currencies.find(c => c.id === id);
    if (currency) { currency.rate = rate; localStorage.setItem('currencies', JSON.stringify(currencies)); alert('تم التحديث'); }
}

function backupSystem() {
    const blob = new Blob([db.export()], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup_${today()}.db`;
    a.click();
    alert('✅ تم حفظ نسخة احتياطية');
}

function restoreBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.db,.sqlite';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = ev => {
            const arr = new Uint8Array(ev.target.result);
            db = new SQL.Database(arr);
            saveDatabase();
            alert('✅ تم استعادة النسخة');
            location.reload();
        };
        reader.readAsArrayBuffer(file);
    };
    input.click();
}

function resetSystem() {
    if (confirm('حذف جميع البيانات؟')) {
        localStorage.clear();
        location.reload();
    }
}

// ======================== دوال عامة للعرض والطباعة ========================
window.previewDocument = function(type, id) {
    let title = '';
    let queryResult = null;
    let isVoucher = false;
    
    switch (type) {
        case 'sales': case 'sales_invoice':
            title = 'فاتورة مبيعات';
            queryResult = query(`SELECT invoice_number, date, customer_id, total, currency, ref, type FROM sales_invoices WHERE id = ?`, [id])[0];
            break;
        case 'purchase': case 'purchase_invoice':
            title = 'فاتورة مشتريات';
            queryResult = query(`SELECT invoice_number, date, supplier_id, total, currency, ref, type FROM purchase_invoices WHERE id = ?`, [id])[0];
            break;
        case 'sales_return':
            title = 'مرتجع مبيعات';
            queryResult = query(`SELECT return_number, date, customer_id, total, currency, ref FROM sales_returns WHERE id = ?`, [id])[0];
            break;
        case 'purchase_return':
            title = 'مرتجع مشتريات';
            queryResult = query(`SELECT return_number, date, supplier_id, total, currency, ref FROM purchase_returns WHERE id = ?`, [id])[0];
            break;
        case 'Receipt': case 'Payment': case 'Advance': case 'Settlement':
            isVoucher = true;
            break;
        default:
            alert('نوع مستند غير معروف');
            return;
    }
    
    let htmlContent = '';
    
    if (isVoucher) {
        const v = query(`SELECT v.*, a1.name as account_name, a2.name as cash_account_name, a3.name as debit_account_name, a4.name as credit_account_name FROM vouchers v LEFT JOIN chart_of_accounts a1 ON v.account_id = a1.id LEFT JOIN chart_of_accounts a2 ON v.cash_account_id = a2.id LEFT JOIN chart_of_accounts a3 ON v.debit_account_id = a3.id LEFT JOIN chart_of_accounts a4 ON v.credit_account_id = a4.id WHERE v.id = ?`, [id])[0];
        if (!v) { alert('السند غير موجود'); return; }
        const number = v[1], date = v[2], ref = v[13], currencyId = v[10], amount = v[9], amountWords = v[11], description = v[12], voucherType = v[3], advanceType = v[14];
        const accountName = v[18], cashAccountName = v[19], debitAccountName = v[20], creditAccountName = v[21];
        switch (voucherType) {
            case 'Receipt':
                title = 'سند قبض';
                htmlContent = buildVoucherHTML(title, number, date, ref, amount, amountWords, currencyId, description, { label1: 'استلمنا من', value1: accountName, label2: 'إلى حساب', value2: cashAccountName });
                break;
            case 'Payment':
                title = 'سند صرف';
                htmlContent = buildVoucherHTML(title, number, date, ref, amount, amountWords, currencyId, description, { label1: 'صرفنا إلى', value1: accountName, label2: 'من حساب', value2: cashAccountName });
                break;
            case 'Advance':
                title = 'سند عربون';
                htmlContent = buildVoucherHTML(title, number, date, ref, amount, amountWords, currencyId, description, { label1: 'النوع', value1: advanceType === 'received' ? 'عربون مقبوض' : 'عربون مدفوع', label2: 'الحساب', value2: accountName, label3: 'حساب الصندوق/البنك', value3: cashAccountName });
                break;
            case 'Settlement':
                title = 'سند تسوية';
                htmlContent = buildVoucherHTML(title, number, date, ref, amount, amountWords, currencyId, description, { label1: 'الحساب المدين', value1: debitAccountName, label2: 'الحساب الدائن', value2: creditAccountName });
                break;
        }
    } else {
        if (!queryResult) { alert('المستند غير موجود'); return; }
        const number = queryResult[0], date = queryResult[1], partyId = queryResult[2], total = queryResult[3], currency = queryResult[4] || 'YER', ref = queryResult[5] || '-', docType = queryResult[6] || 'cash';
        let partyName = '-';
        if (partyId) { const p = query(`SELECT name FROM partners WHERE id = ?`, [partyId])[0]; if (p) partyName = p[0]; }
        let linesQuery = '';
        if (type === 'sales' || type === 'sales_invoice') linesQuery = `SELECT i.name, l.quantity, l.unit_price, l.line_total FROM sales_invoice_lines l JOIN items i ON l.item_id = i.id WHERE l.invoice_id = ?`;
        else if (type === 'purchase' || type === 'purchase_invoice') linesQuery = `SELECT i.name, l.quantity, l.unit_price, l.line_total FROM purchase_invoice_lines l JOIN items i ON l.item_id = i.id WHERE l.invoice_id = ?`;
        else if (type === 'sales_return') linesQuery = `SELECT i.name, l.quantity, l.unit_price, l.line_total FROM sales_return_lines l JOIN items i ON l.item_id = i.id WHERE l.return_id = ?`;
        else if (type === 'purchase_return') linesQuery = `SELECT i.name, l.quantity, l.unit_price, l.line_total FROM purchase_return_lines l JOIN items i ON l.item_id = i.id WHERE l.return_id = ?`;
        let lines = [];
        if (linesQuery) lines = query(linesQuery, [id]);
        htmlContent = buildInvoiceHTML(title, number, date, partyName, docType, currency, ref, total, lines);
    }
    
    const previewWindow = window.open('', '_blank', 'width=800,height=600');
    previewWindow.document.write(`
        <html dir="rtl"><head><title>${title} ${isVoucher ? '' : queryResult[0]}</title>
        <style> body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; background: #f2f2f2; } .card { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); } table { width: 100%; border-collapse: collapse; margin: 10px 0; } td, th { border: 1px solid #ddd; padding: 8px; text-align: center; } th { background: #f2f2f2; } .company-header { display: flex; justify-content: space-between; margin-bottom: 20px; } .no-print { text-align: center; margin-top: 20px; } @media print { .no-print { display: none; } } </style></head>
        <body>
            <div class="company-header"><div><h2>${company.name}</h2><p>${company.phone}</p><p>${company.address}</p></div><div>${company.logo ? `<img src="${company.logo}" style="height:60px">` : ''}</div></div>
            ${htmlContent}
            <div class="no-print"><button onclick="window.print()">طباعة</button> <button onclick="window.close()">إغلاق</button></div>
        </body></html>
    `);
    previewWindow.document.close();
};

function buildVoucherHTML(title, number, date, ref, amount, amountWords, currencyId, description, fields) {
    let detailsHtml = '';
    if (fields.label1) detailsHtml += `<tr><td>${fields.label1}</td><td colspan="3">${fields.value1 || '-'}</td></tr>`;
    if (fields.label2) detailsHtml += `<tr><td>${fields.label2}</td><td colspan="3">${fields.value2 || '-'}</td></tr>`;
    if (fields.label3) detailsHtml += `<tr><td>${fields.label3}</td><td colspan="3">${fields.value3 || '-'}</td></tr>`;
    return `<div class="card"><h2 style="text-align:center">${title}</h2><table><tr><td>الرقم</td><td>${number}</td><td>التاريخ</td><td>${date}</td></tr><tr><td>المرجع</td><td colspan="3">${ref || '-'}</td></tr>${detailsHtml}<tr><td>المبلغ</td><td colspan="3">${formatMoney(amount)} ${getCurrencyName(currencyId)}</td></tr><tr><td>المبلغ كتابة</td><td colspan="3">${amountWords || '-'}</td></tr><tr><td>البيان</td><td colspan="3">${description || '-'}</td></tr></table></div>`;
}

function buildInvoiceHTML(title, number, date, partyName, docType, currency, ref, total, lines) {
    const typeText = docType === 'cash' ? 'نقد' : 'آجل';
    let rows = '';
    lines.forEach(l => { rows += `<tr><td>${l[0]}</td><td>${l[1]}</td><td>${formatMoney(l[2])}</td><td>${formatMoney(l[3])}</td></tr>`; });
    return `<div class="card"><h2 style="text-align:center">${title}</h2><table><tr><td>الرقم</td><td>${number}</td><td>التاريخ</td><td>${date}</td></tr><tr><td>الطرف</td><td colspan="3">${partyName}</td></tr><tr><td>النوع</td><td colspan="3">${typeText}</td></tr><tr><td>المرجع</td><td>${ref}</td><td>العملة</td><td>${currency}</td></tr></table></div><div class="card"><table><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>${rows}<tr style="font-weight:bold"><td colspan="3">الإجمالي الكلي</td><td>${formatMoney(total)}</td></tr></table></div>`;
}

// ======================== دوال الأمان وتسجيل الدخول ========================
function sha256(input) {
    // دالة تشفير بسيطة تعمل على أي متصفح بدون مكتبات خارجية
    function rotateRight(x, n) { return (x >>> n) | (x << (32 - n)); }
    function choose(x, y, z) { return (x & y) ^ (~x & z); }
    function majority(x, y, z) { return (x & y) ^ (x & z) ^ (y & z); }
    function sigma0(x) { return rotateRight(x, 2) ^ rotateRight(x, 13) ^ rotateRight(x, 22); }
    function sigma1(x) { return rotateRight(x, 6) ^ rotateRight(x, 11) ^ rotateRight(x, 25); }
    function gamma0(x) { return rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3); }
    function gamma1(x) { return rotateRight(x, 17) ^ rotateRight(x, 19) ^ (x >>> 10); }
    
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
               0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
               0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
               0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
               0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
               0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
               0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
               0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    
    function sha256core(m, l) {
        const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
        m[l >> 5] |= 0x80 << (24 - l % 32);
        m[((l + 64 >> 9) << 4) + 15] = l;
        for (let i = 0; i < m.length; i += 16) {
            const W = new Array(64);
            for (let t = 0; t < 16; t++) W[t] = m[i + t];
            for (let t = 16; t < 64; t++) W[t] = (gamma1(W[t - 2]) + W[t - 7] + gamma0(W[t - 15]) + W[t - 16]) | 0;
            let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
            for (let t = 0; t < 64; t++) {
                const T1 = (h + sigma1(e) + choose(e, f, g) + K[t] + W[t]) | 0;
                const T2 = (sigma0(a) + majority(a, b, c)) | 0;
                h = g; g = f; f = e; e = (d + T1) | 0; d = c; c = b; b = a; a = (T1 + T2) | 0;
            }
            H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
            H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
        }
        return H.map(x => ('00000000' + (x >>> 0).toString(16)).slice(-8)).join('');
    }
    
    const bytes = [];
    for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i);
        if (code < 0x80) bytes.push(code);
        else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    const words = [];
    for (let i = 0; i < bytes.length; i += 4) {
        words.push((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]);
    }
    return Promise.resolve(sha256core(words, bytes.length * 8));
}

function loginPage() {
    content.innerHTML = `
        <div class="card" style="max-width:400px;margin:50px auto;padding:25px;">
            <h2 style="text-align:center;"><i class="fas fa-lock"></i> تسجيل الدخول</h2>
            <div id="loginError" style="color:red;text-align:center;margin-bottom:10px;"></div>
            <label>اسم المستخدم</label>
            <input id="loginUser" placeholder="أدخل اسم المستخدم">
            <label>كلمة المرور</label>
            <input id="loginPass" type="password" placeholder="************">
            <br><br>
            <button onclick="performLogin()" style="width:100%;">دخول</button>
        </div>
    `;
}

async function performLogin() {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value.trim();
    if (!username || !password) {
        document.getElementById('loginError').innerText = 'الرجاء إدخال اسم المستخدم وكلمة المرور';
        return;
    }
    const hashedPassword = await sha256(password);
    const user = users.find(u => u.username === username && u.password === hashedPassword);
    if (user) {
        currentUser = { username: user.username, role: user.role, permissions: user.permissions || allPermissions };
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        dashboard();
    } else {
        document.getElementById('loginError').innerText = 'اسم المستخدم أو كلمة المرور غير صحيحة';
    }
}

function logout() {
    sessionStorage.removeItem('currentUser');
    currentUser = null;
    loginPage();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// تعريض دوال الصفحات
window.dashboard = dashboard;
window.productsPage = productsPage;
window.customersPage = customersPage;
window.suppliersPage = suppliersPage;
window.accountsPage = accountsPage;
window.salesPage = salesPage;
window.purchasesPage = purchasesPage;
window.stockPage = stockPage;
window.cashPage = cashPage;
window.journalPage = journalPage;
window.vouchersPage = vouchersPage;
window.lowStockPage = lowStockPage;
window.companySettings = companySettings;
window.saveCompanyData = saveCompanyData;
window.currencyRatesPage = currencyRatesPage;
window.saveCurrencyRate = saveCurrencyRate;
window.backupSystem = backupSystem;
window.restoreBackup = restoreBackup;
window.resetSystem = resetSystem;
window.loginPage = loginPage;
window.performLogin = performLogin;
window.logout = logout;
window.secureAccess = secureAccess;
window.hasPermission = hasPermission;
window.allPermissions = allPermissions;

// ======================== بدء التشغيل ========================
window.onload = async () => {
    await initDatabase();
    
    if (currentUser) {
        dashboard();
    } else {
        loginPage();
    }

    window.db = db;
    window.query = query;
    window.run = run;
    window.today = today;
    window.now = now;
    window.formatMoney = formatMoney;
    window.getCurrencyName = getCurrencyName;
    window.getCurrencyOptions = getCurrencyOptions;
    window.numberToArabicWords = numberToArabicWords;
    window.company = company;
    window.currencies = currencies;
    window.settings = settings;
    window.saveDatabase = saveDatabase;
    window.addLog = addLog;
    window.currentUser = currentUser;
};
