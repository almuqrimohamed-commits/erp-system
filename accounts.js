// accounts.js - وحدة دليل الحسابات (نسخة نهائية مع تجميع هرمي صحيح)
console.log('📊 تحميل وحدة الحسابات...');

// ======================== دالة التهيئة (إنشاء الحسابات الافتراضية كاملة) ========================
function initAccounts() {
    // التحقق من وجود حسابات مسبقاً
    const count = query('SELECT COUNT(*) FROM chart_of_accounts')[0][0];
    if (count > 0) return;

    // دالة مساعدة لإضافة حساب
    function add(id, number, name, type, parentId) {
        const parent = parentId === -1 ? null : parentId;
        run(
            `INSERT INTO chart_of_accounts (id, code, name, type, parent_id, is_active)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [id, number, name, type, parent]
        );
    }

    /* ======================= */
    /* 1000 الأصول */
    /* ======================= */
    add(1000, "1000", "الأصول", "Asset", -1);
    add(1100, "1100", "الأصول المتداولة", "Asset", 1000);
    add(1110, "1110", "الصندوق", "Asset", 1100);
    add(11101, "11101", "صندوق رئيسي", "Asset", 1110);
    add(11102, "11102", "صندوق فرعي", "Asset", 1110);
    add(1120, "1120", "البنك", "Asset", 1100);
    add(11201, "11201", "حساب جاري", "Asset", 1120);
    add(11202, "11202", "حساب توفير", "Asset", 1120);
    add(1130, "1130", "العملاء (ذمم مدينة)", "Asset", 1100);
    add(1140, "1140", "أوراق قبض (شيكات)", "Asset", 1100);
    add(1150, "1150", "عهد وسلف الموظفين", "Asset", 1100);
    add(1160, "1160", "مصروفات مقدمة", "Asset", 1100);
    add(1170, "1170", "المخزون", "Asset", 1100);
    add(11701, "11701", "مخزون أسمدة", "Asset", 1170);
    add(11702, "11702", "مخزون مبيدات", "Asset", 1170);
    add(11703, "11703", "مخزون بذور", "Asset", 1170);
    add(11704, "11704", "مخزون أدوات زراعية", "Asset", 1170);
    add(1180, "1180", "بضاعة بالطريق", "Asset", 1100);
    
    add(1200, "1200", "الأصول الثابتة", "Asset", 1000);
    add(1210, "1210", "سيارات", "Asset", 1200);
    add(1220, "1220", "أجهزة ومعدات", "Asset", 1200);
    add(1230, "1230", "أثاث وتجهيزات", "Asset", 1200);
    add(1240, "1240", "أجهزة كمبيوتر", "Asset", 1200);
    add(1250, "1250", "مجمع إهلاك الأصول", "Asset", 1200);

    /* ======================= */
    /* 2000 الخصوم */
    /* ======================= */
    add(2000, "2000", "الخصوم", "Liability", -1);
    add(2100, "2100", "الخصوم المتداولة", "Liability", 2000);
    add(2110, "2110", "الموردون (ذمم دائنة)", "Liability", 2100);
    add(2120, "2120", "أوراق دفع", "Liability", 2100);
    add(2130, "2130", "مصروفات مستحقة", "Liability", 2100);
    add(2140, "2140", "إيرادات مقدمة", "Liability", 2100);
    add(2150, "2150", "ضريبة القيمة المضافة المستحقة", "Liability", 2100);
    add(2160, "2160", "أمانات للغير", "Liability", 2100);
    
    add(2200, "2200", "خصوم طويلة الأجل", "Liability", 2000);
    add(2210, "2210", "قروض طويلة الأجل", "Liability", 2200);

    /* ======================= */
    /* 3000 حقوق الملكية */
    /* ======================= */
    add(3000, "3000", "حقوق الملكية", "Equity", -1);
    add(3100, "3100", "رأس المال", "Equity", 3000);
    add(3200, "3200", "المسحوبات الشخصية", "Equity", 3000);
    add(3300, "3300", "الأرباح المحتجزة", "Equity", 3000);
    add(3400, "3400", "صافي الربح / الخسارة", "Equity", 3000);

    /* ======================= */
    /* 4000 الإيرادات */
    /* ======================= */
    add(4000, "4000", "الإيرادات", "Revenue", -1);
    add(4100, "4100", "صافي المبيعات", "Revenue", 4000);
    add(4110, "4110", "المبيعات النقدية", "Revenue", 4100);
    add(4120, "4120", "المبيعات الآجلة", "Revenue", 4100);
    add(4130, "4130", "الخصم المسموح به", "Revenue", 4100);
    add(4140, "4140", "مردودات المبيعات", "Revenue", 4100);
    
    add(4200, "4200", "إيرادات أخرى", "Revenue", 4000);
    add(4210, "4210", "عمولات", "Revenue", 4200);
    add(4220, "4220", "أرباح بيع أصول", "Revenue", 4200);
    add(4230, "4230", "إيرادات متنوعة", "Revenue", 4200);

    /* ======================= */
    /* 5000 تكلفة البضاعة المباعة */
    /* ======================= */
    add(5000, "5000", "تكلفة البضاعة المباعة", "Expense", -1);
    add(5100, "5100", "تكلفة المشتريات", "Expense", 5000);
    add(5200, "5200", "مردودات المشتريات", "Expense", 5000);
    add(5300, "5300", "خصم مكتسب", "Expense", 5000);
    add(5400, "5400", "مصروفات شراء", "Expense", 5000);
    add(5401, "5401", "نقل مشتريات", "Expense", 5400);
    add(5402, "5402", "تحميل وتنزيل", "Expense", 5400);

    /* ======================= */
    /* 6000 المصروفات */
    /* ======================= */
    add(6000, "6000", "المصروفات", "Expense", -1);
    add(6100, "6100", "الرواتب والأجور", "Expense", 6000);
    add(6200, "6200", "الإيجار", "Expense", 6000);
    add(6300, "6300", "الكهرباء", "Expense", 6000);
    add(6400, "6400", "الماء", "Expense", 6000);
    add(6500, "6500", "الإنترنت", "Expense", 6000);
    add(6600, "6600", "الوقود", "Expense", 6000);
    add(6700, "6700", "الصيانة", "Expense", 6000);
    add(6800, "6800", "مصروفات نقل", "Expense", 6000);
    add(6900, "6900", "مصروفات بنكية", "Expense", 6000);
    add(7000, "7000", "قرطاسية ومطبوعات", "Expense", 6000);
    add(7100, "7100", "مصروفات تسويق", "Expense", 6000);
    add(7200, "7200", "ضيافة", "Expense", 6000);
    add(7300, "7300", "إهلاك الأصول", "Expense", 6000);
    add(7400, "7400", "مصروفات أخرى", "Expense", 6000);

    /* ======================= */
    /* 8000 ضريبة القيمة المضافة */
    /* ======================= */
    add(8000, "8000", "ضريبة القيمة المضافة", "Liability", -1);
    add(8100, "8100", "ضريبة مدخلات", "Liability", 8000);
    add(8200, "8200", "ضريبة مخرجات", "Liability", 8000);

    /* ======================= */
    /* 9000 حسابات رقابية */
    /* ======================= */
    add(9000, "9000", "حسابات رقابية", "Asset", -1);
    add(9100, "9100", "هالك وتالف مخزون", "Asset", 9000);
    add(9200, "9200", "فروقات جرد", "Asset", 9000);
    add(9300, "9300", "ديون مشكوك في تحصيلها", "Asset", 9000);
    add(9400, "9400", "مخصص ديون معدومة", "Asset", 9000);

    saveDatabase();
    console.log('✅ تم إدراج جميع الحسابات وفق الشجرة الجديدة.');
}

// ======================== صفحة إدارة الحسابات ========================
function accountsPage() {
    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-list"></i> إدارة الحسابات</h2>
            <button onclick="addAccountForm()"><i class="fas fa-plus"></i> إضافة حساب</button>
            <button onclick="accountsListPage()"><i class="fas fa-table"></i> عرض الحسابات</button>
            <button onclick="dashboard()"><i class="fas fa-arrow-right"></i> رجوع</button>
        </div>
    `;
}

function accountsListPage() {
    const accounts = query(`
        SELECT id, code, name, type, parent_id
        FROM chart_of_accounts
        WHERE is_active = 1
        ORDER BY code
    `);

    const accountMap = {};
    const rootAccounts = [];
    accounts.forEach(acc => {
        const id = acc[0];
        const code = acc[1];
        const name = acc[2];
        const type = acc[3];
        const parentId = acc[4];
        const obj = { id, code, name, type, parentId, children: [] };
        accountMap[id] = obj;
        if (parentId === null) {
            rootAccounts.push(obj);
        }
    });
    accounts.forEach(acc => {
        const id = acc[0];
        const parentId = acc[4];
        if (parentId !== null && accountMap[parentId]) {
            accountMap[parentId].children.push(accountMap[id]);
        }
    });

    let rows = '';
    function renderTree(accs, level = 0) {
        accs.forEach(acc => {
            const indent = '— '.repeat(level);
            const balance = getAccountBalance(acc.id);
            const isSystem = acc.id >= 1000 && acc.id <= 9999;
            const deleteBtn = isSystem ? '' : `<button onclick="deleteAccount(${acc.id})">حذف</button>`;
            rows += `
                <tr>
                    <td>${acc.code}</td>
                    <td>${indent}${acc.name}</td>
                    <td>${getAccountTypeName(acc.type)}</td>
                    <td>${formatMoney(balance)}</td>
                    <td>
                        <button onclick="viewAccount(${acc.id})">عرض</button>
                        <button onclick="editAccount(${acc.id})">تعديل</button>
                        ${deleteBtn}
                    </td>
                </tr>
            `;
            if (acc.children.length > 0) {
                renderTree(acc.children, level + 1);
            }
        });
    }
    renderTree(rootAccounts);

    content.innerHTML = `
        <div class="card">
            <h2>قائمة الحسابات</h2>
            <input id="searchAccount" placeholder="بحث باسم الحساب أو الرقم" oninput="searchAccounts()">
            <br><br>
            <button onclick="addAccountForm()">إضافة حساب</button>
            <button onclick="accountsPage()">رجوع</button>
        </div>
        <div class="card">
            <table>
                <thead><tr><th>رقم الحساب</th><th>اسم الحساب</th><th>النوع</th><th>الرصيد</th><th>الإجراءات</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function searchAccounts() {
    const text = document.getElementById('searchAccount').value.toLowerCase();
    const accounts = query(`
        SELECT id, code, name, type, parent_id
        FROM chart_of_accounts
        WHERE is_active = 1 AND (LOWER(name) LIKE ? OR code LIKE ?)
        ORDER BY code
    `, [`%${text}%`, `%${text}%`]);

    const accountMap = {};
    const rootAccounts = [];
    accounts.forEach(acc => {
        const id = acc[0];
        const code = acc[1];
        const name = acc[2];
        const type = acc[3];
        const parentId = acc[4];
        const obj = { id, code, name, type, parentId, children: [] };
        accountMap[id] = obj;
        if (parentId === null) {
            rootAccounts.push(obj);
        }
    });
    accounts.forEach(acc => {
        const id = acc[0];
        const parentId = acc[4];
        if (parentId !== null && accountMap[parentId]) {
            accountMap[parentId].children.push(accountMap[id]);
        }
    });

    let rows = '';
    function renderTree(accs, level = 0) {
        accs.forEach(acc => {
            const indent = '— '.repeat(level);
            const balance = getAccountBalance(acc.id);
            const isSystem = acc.id >= 1000 && acc.id <= 9999;
            const deleteBtn = isSystem ? '' : `<button onclick="deleteAccount(${acc.id})">حذف</button>`;
            rows += `
                <tr>
                    <td>${acc.code}</td>
                    <td>${indent}${acc.name}</td>
                    <td>${getAccountTypeName(acc.type)}</td>
                    <td>${formatMoney(balance)}</td>
                    <td>
                        <button onclick="viewAccount(${acc.id})">عرض</button>
                        <button onclick="editAccount(${acc.id})">تعديل</button>
                        ${deleteBtn}
                    </td>
                </tr>
            `;
            if (acc.children.length > 0) {
                renderTree(acc.children, level + 1);
            }
        });
    }
    renderTree(rootAccounts);

    document.querySelector('table tbody').innerHTML = rows;
}

// ======================== إضافة حساب ========================
function addAccountForm() {
    initAccounts();

    const accounts = query('SELECT id, code, name FROM chart_of_accounts WHERE is_active = 1 ORDER BY code');
    let parentOptions = '<option value="-1">اختر الحساب الأب</option>';
    accounts.forEach(acc => {
        parentOptions += `<option value="${acc[0]}">${acc[1]} - ${acc[2]}</option>`;
    });

    content.innerHTML = `
        <div class="card">
            <h2>إضافة حساب جديد</h2>
            <label>تصنيف الحساب</label>
            <select id="accountLevel" onchange="toggleParentAccount()">
                <option value="main">حساب رئيسي</option>
                <option value="sub">حساب فرعي</option>
            </select>
            <label>اسم الحساب</label>
            <input id="accName" placeholder="أدخل اسم الحساب">
            <label>نوع الحساب</label>
            <select id="accType">
                <option value="Asset">أصول</option>
                <option value="Liability">خصوم</option>
                <option value="Equity">حقوق ملكية</option>
                <option value="Revenue">إيرادات</option>
                <option value="Expense">مصروفات</option>
            </select>
            <label>الحساب الأب</label>
            <select id="parentAccount" disabled onchange="setTypeFromParent()">${parentOptions}</select>
            <br><br>
            <button onclick="saveAccount()">حفظ الحساب</button>
            <button onclick="accountsPage()">رجوع</button>
        </div>
    `;
    toggleParentAccount();
}

function toggleParentAccount() {
    const level = document.getElementById('accountLevel').value;
    const parentSelect = document.getElementById('parentAccount');
    const typeSelect = document.getElementById('accType');
    if (level === 'main') {
        parentSelect.disabled = true;
        typeSelect.disabled = false;
    } else {
        parentSelect.disabled = false;
        typeSelect.disabled = true;
    }
}

function generateAccountNumber(parentId) {
    if (parentId == -1) {
        const result = query(`
            SELECT MAX(CAST(code AS INTEGER)) FROM chart_of_accounts
            WHERE parent_id IS NULL AND code GLOB '[0-9]*'
        `);
        const max = result[0] && result[0][0] ? result[0][0] : 0;
        return String(max + 1);
    } else {
        const parent = query('SELECT code FROM chart_of_accounts WHERE id = ?', [parentId])[0];
        if (!parent) return '';
        const parentCode = parent[0];
        const children = query(`
            SELECT code FROM chart_of_accounts
            WHERE parent_id = ? AND is_active = 1
        `, [parentId]);
        if (children.length === 0) return parentCode + '01';
        let max = 0;
        children.forEach(child => {
            const suffix = child[0].substring(parentCode.length);
            const num = parseInt(suffix, 10);
            if (!isNaN(num) && num > max) max = num;
        });
        const next = String(max + 1).padStart(2, '0');
        return parentCode + next;
    }
}

function saveAccount() {
    const name = document.getElementById('accName').value.trim();
    const type = document.getElementById('accType').value;
    const level = document.getElementById('accountLevel').value;
    let parentId = Number(document.getElementById('parentAccount').value);
    if (level === 'main') parentId = -1;

    if (!name) { alert('أدخل اسم الحساب'); return; }
    if (level === 'sub' && parentId === -1) { alert('اختر الحساب الأب'); return; }

    const exists = query('SELECT id FROM chart_of_accounts WHERE name = ? AND is_active = 1', [name]);
    if (exists.length > 0) { alert('اسم الحساب موجود مسبقاً'); return; }

    const number = generateAccountNumber(parentId);
    const finalParentId = parentId === -1 ? null : parentId;

    run(
        'INSERT INTO chart_of_accounts (code, name, type, parent_id) VALUES (?, ?, ?, ?)',
        [number, name, type, finalParentId]
    );
    saveDatabase();
    addLog('إضافة حساب', name);
    alert('تم إضافة الحساب بنجاح');
    accountsListPage();
}

// ======================== حذف حساب ========================
function deleteAccount(id) {
    const acc = query('SELECT code, name, type FROM chart_of_accounts WHERE id = ?', [id])[0];
    if (!acc) return;
    if (id >= 1000 && id <= 9999) { alert('لا يمكن حذف حساب أساسي'); return; }

    const children = query('SELECT id FROM chart_of_accounts WHERE parent_id = ? AND is_active = 1', [id]);
    if (children.length > 0) { alert('لا يمكن حذف الحساب لأنه يحتوي على حسابات فرعية'); return; }

    const used = query(`
        SELECT COUNT(*) FROM journal_entry_lines WHERE account_id = ?
    `, [id])[0][0];
    if (used > 0) { alert('لا يمكن حذف الحساب لأنه مستخدم في قيود محاسبية'); return; }

    const balance = getAccountBalance(id);
    if (Math.abs(balance) > 0.001) { alert('لا يمكن حذف الحساب لأن له رصيداً'); return; }

    if (!confirm('هل أنت متأكد من حذف الحساب؟')) return;

    run('UPDATE chart_of_accounts SET is_active = 0 WHERE id = ?', [id]);
    saveDatabase();
    alert('تم حذف الحساب');
    accountsListPage();
}

// ======================== عرض وتعديل ========================
function viewAccount(id) {
    const acc = query(`
        SELECT id, code, name, type, parent_id, created_at
        FROM chart_of_accounts
        WHERE id = ?
    `, [id])[0];
    if (!acc) return;

    let parentName = 'لا يوجد';
    if (acc[4]) {
        const parent = query('SELECT code, name FROM chart_of_accounts WHERE id = ?', [acc[4]])[0];
        if (parent) parentName = `${parent[0]} - ${parent[1]}`;
    }
    const balance = getAccountBalance(id);

    content.innerHTML = `
        <div class="card">
            <h2>عرض الحساب</h2>
            <table>
                <tr><td><b>رقم الحساب</b></td><td>${acc[1]}</td></tr>
                <tr><td><b>اسم الحساب</b></td><td>${acc[2]}</td></tr>
                <tr><td><b>نوع الحساب</b></td><td>${getAccountTypeName(acc[3])}</td></tr>
                <tr><td><b>الحساب الأب</b></td><td>${parentName}</td></tr>
                <tr><td><b>الرصيد</b></td><td>${formatMoney(balance)}</td></tr>
                <tr><td><b>تاريخ الإنشاء</b></td><td>${acc[5] || '-'}</td></tr>
            </table>
            <br>
            <button onclick="editAccount(${id})">تعديل الحساب</button>
            <button onclick="accountsListPage()">رجوع</button>
        </div>
    `;
}

function editAccount(id) {
    const acc = query('SELECT code, name, type, parent_id FROM chart_of_accounts WHERE id = ?', [id])[0];
    if (!acc) return;
    if (id >= 1000 && id <= 9999) { alert('لا يمكن تعديل حساب أساسي'); return; }

    content.innerHTML = `
        <div class="card">
            <h2>تعديل الحساب</h2>
            <label>رقم الحساب</label>
            <input value="${acc[0]}" disabled>
            <label>اسم الحساب</label>
            <input id="editAccName" value="${acc[1]}">
            <label>نوع الحساب</label>
            <select id="editAccType" ${acc[3] ? '' : 'disabled'}>
                <option value="Asset" ${acc[2]==='Asset'?'selected':''}>أصول</option>
                <option value="Liability" ${acc[2]==='Liability'?'selected':''}>خصوم</option>
                <option value="Equity" ${acc[2]==='Equity'?'selected':''}>حقوق ملكية</option>
                <option value="Revenue" ${acc[2]==='Revenue'?'selected':''}>إيرادات</option>
                <option value="Expense" ${acc[2]==='Expense'?'selected':''}>مصروفات</option>
            </select>
            <br><br>
            <button onclick="updateAccount(${id})">حفظ التعديلات</button>
            <button onclick="accountsListPage()">رجوع</button>
        </div>
    `;
}

function updateAccount(id) {
    const newName = document.getElementById('editAccName').value.trim();
    const newType = document.getElementById('editAccType')?.value;
    if (!newName) { alert('الاسم مطلوب'); return; }

    if (newType) {
        run('UPDATE chart_of_accounts SET name = ?, type = ? WHERE id = ?', [newName, newType, id]);
    } else {
        run('UPDATE chart_of_accounts SET name = ? WHERE id = ?', [newName, id]);
    }
    saveDatabase();
    alert('تم التعديل');
    accountsListPage();
}

// ======================== دوال مساعدة ========================
function getAccountTypeName(type) {
    const types = { 'Asset': 'أصول', 'Liability': 'خصوم', 'Equity': 'حقوق ملكية', 'Revenue': 'إيرادات', 'Expense': 'مصروفات' };
    return types[type] || '';
}

function formatMoney(amount) {
    return Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setTypeFromParent() {
    const parentId = Number(document.getElementById('parentAccount').value);
    if (parentId === -1) return;
    const parent = query('SELECT type FROM chart_of_accounts WHERE id = ?', [parentId])[0];
    if (parent) document.getElementById('accType').value = parent[0];
}

// ======================== دوال الرصيد (تجميع هرمي صحيح) ========================
function getAccountBalance(accountId) {
    const account = query(`SELECT type, code FROM chart_of_accounts WHERE id = ? AND is_active = 1`, [accountId])[0];
    if (!account) return 0;
    
    const accType = account[0];
    const accCode = account[1];
    const children = query(`SELECT id, code FROM chart_of_accounts WHERE parent_id = ? AND is_active = 1`, [accountId]);
    
    let totalBalance = 0;
    
    if (children.length > 0) {
        // حساب تجميعي: نجمع أرصدة فروعه
        children.forEach(child => {
            const childBalance = getAccountBalance(child[0]);
            // إذا كان الحساب الأب هو "صافي المبيعات" (4100)، نتعامل مع الحسابات المخفضة بشكل خاص
            if (accCode === '4100') {
                const childCode = child[1];
                if (childCode === '4130' || childCode === '4140') {
                    // حسابات مخفضة للإيرادات: تُطرح بدلاً من أن تُجمع
                    totalBalance -= Math.abs(childBalance);
                } else {
                    totalBalance += childBalance;
                }
            } else {
                totalBalance += childBalance;
            }
        });
    } else {
        // حساب طرفي: نأخذ رصيده المخزن مباشرة
        const balanceRow = query(`SELECT current_balance FROM chart_of_accounts WHERE id = ?`, [accountId]);
        totalBalance = (balanceRow.length && balanceRow[0][0] !== null) ? balanceRow[0][0] : 0;
    }
    
    // ضبط العرض: الحسابات ذات الطبيعة الدائنة نعرض قيمتها المطلقة (لأن رصيدها الطبيعي دائن)
    if (accType === 'Liability' || accType === 'Equity' || accType === 'Revenue') {
        return Math.abs(totalBalance);
    } else {
        return totalBalance;
    }
}

function getCashAccount() {
    return query('SELECT id FROM chart_of_accounts WHERE code = ?', ['11101'])[0];
}

function getCashBalance() {
    const cashAcc = getCashAccount();
    return cashAcc ? getAccountBalance(cashAcc[0]) : 0;
}

// ======================== دوال إنشاء حسابات العملاء والموردين ========================
function createAccountForCustomer(customerName) {
    const parent = query(`SELECT id, code FROM chart_of_accounts WHERE code = '1130' AND is_active = 1`)[0];
    if (!parent) {
        alert('❌ حساب العملاء الرئيسي (1130) غير موجود.');
        return -1;
    }

    const children = query(`SELECT code FROM chart_of_accounts WHERE parent_id = ? AND is_active = 1 ORDER BY code`, [parent[0]]);
    let nextCode;
    if (children.length === 0) {
        nextCode = parent[1] + '001';
    } else {
        const last = children[children.length - 1][0];
        if (last.startsWith(parent[1])) {
            const suffix = last.substring(parent[1].length);
            const num = parseInt(suffix, 10);
            nextCode = parent[1] + String(num + 1).padStart(3, '0');
        } else {
            nextCode = parent[1] + '001';
        }
    }

    const result = run(
        `INSERT INTO chart_of_accounts (code, name, type, parent_id, is_active) VALUES (?, ?, 'Asset', ?, 1)`,
        [nextCode, customerName, parent[0]]
    );

    if (result.error) {
        alert('❌ فشل إنشاء حساب العميل: ' + result.error);
        return -1;
    }

    let newId = -1;
    const idResult = query(`SELECT id FROM chart_of_accounts WHERE code = ?`, [nextCode]);
    if (idResult.length && idResult[0][0]) {
        newId = idResult[0][0];
    }

    if (newId <= 0) {
        alert('❌ لم يتم استرداد رقم الحساب الجديد بشكل صحيح.');
        return -1;
    }

    run(`UPDATE chart_of_accounts SET current_balance = 0 WHERE id = ?`, [newId]);
    saveDatabase();
    alert('✅ تم إنشاء حساب للعميل برقم: ' + nextCode);
    return newId;
}

function createAccountForSupplier(supplierName) {
    const parent = query(`SELECT id, code FROM chart_of_accounts WHERE code = '2110' AND is_active = 1`)[0];
    if (!parent) {
        alert('❌ حساب الموردين الرئيسي (2110) غير موجود.');
        return -1;
    }

    const children = query(`SELECT code FROM chart_of_accounts WHERE parent_id = ? AND is_active = 1 ORDER BY code`, [parent[0]]);
    let nextCode;
    if (children.length === 0) {
        nextCode = parent[1] + '001';
    } else {
        const last = children[children.length - 1][0];
        if (last.startsWith(parent[1])) {
            const suffix = last.substring(parent[1].length);
            const num = parseInt(suffix, 10);
            nextCode = parent[1] + String(num + 1).padStart(3, '0');
        } else {
            nextCode = parent[1] + '001';
        }
    }

    const result = run(
        `INSERT INTO chart_of_accounts (code, name, type, parent_id, is_active) VALUES (?, ?, 'Liability', ?, 1)`,
        [nextCode, supplierName, parent[0]]
    );

    if (result.error) {
        alert('❌ فشل إنشاء حساب المورد: ' + result.error);
        return -1;
    }

    let newId = -1;
    const idResult = query(`SELECT id FROM chart_of_accounts WHERE code = ?`, [nextCode]);
    if (idResult.length && idResult[0][0]) {
        newId = idResult[0][0];
    }

    if (newId <= 0) {
        alert('❌ لم يتم استرداد رقم الحساب الجديد بشكل صحيح.');
        return -1;
    }

    run(`UPDATE chart_of_accounts SET current_balance = 0 WHERE id = ?`, [newId]);
    saveDatabase();
    alert('✅ تم إنشاء حساب للمورد برقم: ' + nextCode);
    return newId;
}

// تعريض الدوال
window.initAccounts = initAccounts;
window.accountsPage = accountsPage;
window.accountsListPage = accountsListPage;
window.searchAccounts = searchAccounts;
window.addAccountForm = addAccountForm;
window.toggleParentAccount = toggleParentAccount;
window.saveAccount = saveAccount;
window.deleteAccount = deleteAccount;
window.viewAccount = viewAccount;
window.editAccount = editAccount;
window.updateAccount = updateAccount;
window.setTypeFromParent = setTypeFromParent;
window.getAccountBalance = getAccountBalance;
window.getCashAccount = getCashAccount;
window.getCashBalance = getCashBalance;
window.createAccountForCustomer = createAccountForCustomer;
window.createAccountForSupplier = createAccountForSupplier;