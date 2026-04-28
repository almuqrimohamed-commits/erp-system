// settings.js - وحدة الإعدادات الشاملة (مع واجهة منح الصلاحيات)
console.log('⚙️ تحميل وحدة الإعدادات...');

// ======================== صفحة الإعدادات الرئيسية ========================
function settingsPage() {
    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-cogs"></i> الإعدادات</h2>
        </div>
        <div class="card">
            <h3><i class="fas fa-building"></i> بيانات الشركة</h3>
            <button onclick="companySettingsForm()">تعديل بيانات الشركة</button>
        </div>
        <div class="card">
            <h3><i class="fas fa-users-cog"></i> المستخدمون</h3>
            <button onclick="usersManagementPage()">إدارة المستخدمين</button>
        </div>
        <div class="card">
            <h3><i class="fas fa-exchange-alt"></i> أسعار الصرف</h3>
            <button onclick="currencyManagementPage()">إدارة العملات</button>
        </div>
        <div class="card">
            <h3><i class="fas fa-download"></i> النسخ الاحتياطي</h3>
            <button onclick="backupSystem()">حفظ نسخة احتياطية</button>
            <button onclick="restoreBackup()">استعادة نسخة</button>
        </div>
        <div class="card">
            <h3><i class="fas fa-exclamation-circle"></i> إعادة تعيين</h3>
            <button onclick="resetSystem()" class="danger-btn">إعادة تعيين النظام بالكامل</button>
        </div>
        <div class="card">
            <button onclick="dashboard()">↩️ رجوع</button>
        </div>
  <div class="card">
    <h3>الصيانة</h3>

    <button onclick="runBalanceRebuild()">
        🔍 تدقيق وإصلاح الأرصدة
    </button>
</div>
    `;
}

// ======================== إعدادات الشركة ========================
function companySettingsForm() {
    const c = window.company || {};
    content.innerHTML = `
        <div class="card">
            <h2>بيانات الشركة</h2>
            <label>اسم الشركة</label>
            <input id="companyName" value="${c.name || ''}">
            <label>الهاتف</label>
            <input id="companyPhone" value="${c.phone || ''}">
            <label>العنوان</label>
            <input id="companyAddress" value="${c.address || ''}">
            
            <div style="display:flex; gap:20px; margin-top:15px; flex-wrap:wrap;">
                <div style="flex:1; min-width:200px;">
                    <label>الشعار (Logo)</label><br>
                    <input type="file" id="companyLogoFile" accept="image/*" onchange="previewLogo()">
                    <input type="hidden" id="companyLogoData" value="${c.logo || ''}">
                    <div id="logoPreview" style="margin-top:10px;">
                        ${c.logo ? `<img src="${c.logo}" style="max-height:80px; border:1px solid #ddd; padding:5px;">` : '<p>لا يوجد شعار</p>'}
                    </div>
                </div>
                
                <div style="flex:1; min-width:200px;">
                    <label>الختم (Stamp)</label><br>
                    <input type="file" id="companyStampFile" accept="image/*" onchange="previewStamp()">
                    <input type="hidden" id="companyStampData" value="${c.stamp || ''}">
                    <div id="stampPreview" style="margin-top:10px;">
                        ${c.stamp ? `<img src="${c.stamp}" style="max-height:80px; border:1px solid #ddd; padding:5px;">` : '<p>لا يوجد ختم</p>'}
                    </div>
                </div>
            </div>
            
            <br><br>
            <button onclick="saveCompanySettings()">حفظ</button>
            <button onclick="settingsPage()">رجوع</button>
        </div>
    `;
}

function previewLogo() {
    const file = document.getElementById('companyLogoFile').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('companyLogoData').value = e.target.result;
        document.getElementById('logoPreview').innerHTML = `<img src="${e.target.result}" style="max-height:80px; border:1px solid #ddd; padding:5px;">`;
    };
    reader.readAsDataURL(file);
}

function previewStamp() {
    const file = document.getElementById('companyStampFile').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('companyStampData').value = e.target.result;
        document.getElementById('stampPreview').innerHTML = `<img src="${e.target.result}" style="max-height:80px; border:1px solid #ddd; padding:5px;">`;
    };
    reader.readAsDataURL(file);
}

function saveCompanySettings() {
    const company = {
        name: document.getElementById('companyName').value.trim(),
        phone: document.getElementById('companyPhone').value.trim(),
        address: document.getElementById('companyAddress').value.trim(),
        logo: document.getElementById('companyLogoData').value,
        stamp: document.getElementById('companyStampData').value
    };
    localStorage.setItem('company', JSON.stringify(company));
    window.company = company;
    alert('تم حفظ بيانات الشركة بنجاح');
    settingsPage();
}

// ======================== إدارة المستخدمين (مع الصلاحيات) ========================
function usersManagementPage() {
    const users = JSON.parse(localStorage.getItem('users')) || [];
    let rows = '';
    users.forEach((u, i) => {
        const permCount = u.permissions ? u.permissions.length : (u.role === 'admin' ? 'كل الصلاحيات' : '0');
        rows += `<tr>
            <td>${u.username}</td>
            <td>${u.role === 'admin' ? 'مدير' : 'مستخدم'}</td>
            <td>${permCount}</td>
            <td>
                <button onclick="editUserForm(${i})">تعديل</button>
                <button onclick="deleteUser(${i})">حذف</button>
            </td>
        </tr>`;
    });
    content.innerHTML = `
        <div class="card">
            <h2>إدارة المستخدمين</h2>
            <button onclick="addUserForm()">➕ إضافة مستخدم</button>
        </div>
        <div class="card">
            <table>
                <tr><th>اسم المستخدم</th><th>الصلاحية</th><th>عدد الصلاحيات</th><th>إجراءات</th></tr>
                ${rows || '<tr><td colspan="4">لا يوجد مستخدمين</td></tr>'}
            </table>
            <button onclick="settingsPage()">رجوع</button>
        </div>
    `;
}

function getPermissionsHTML(currentPermissions = []) {
    const groups = {
        'المبيعات': ['manage_sales', 'edit_sales', 'delete_sales'],
        'المشتريات': ['manage_purchases', 'edit_purchases', 'delete_purchases'],
        'السندات': ['manage_vouchers', 'edit_vouchers', 'delete_vouchers'],
        'القيود اليومية': ['manage_journal', 'edit_journal', 'delete_journal'],
        'الحسابات': ['manage_accounts', 'edit_accounts', 'delete_accounts'],
        'العملاء والموردين': ['manage_partners', 'edit_partners', 'delete_partners'],
        'الأصناف': ['manage_products', 'edit_products', 'delete_products'],
        'النظام': ['manage_users', 'manage_settings', 'view_reports', 'backup_restore', 'reset_system']
    };
    
    const labels = {
        'manage_sales': 'إدارة المبيعات', 'edit_sales': 'تعديل الفواتير', 'delete_sales': 'حذف/استعادة الفواتير',
        'manage_purchases': 'إدارة المشتريات', 'edit_purchases': 'تعديل الفواتير', 'delete_purchases': 'حذف/استعادة الفواتير',
        'manage_vouchers': 'إدارة السندات', 'edit_vouchers': 'تعديل السندات', 'delete_vouchers': 'حذف/استعادة السندات',
        'manage_journal': 'إدارة القيود', 'edit_journal': 'تعديل القيود', 'delete_journal': 'حذف/استعادة القيود',
        'manage_accounts': 'إدارة الحسابات', 'edit_accounts': 'تعديل الحسابات', 'delete_accounts': 'حذف الحسابات',
        'manage_partners': 'إدارة العملاء والموردين', 'edit_partners': 'تعديل', 'delete_partners': 'حذف',
        'manage_products': 'إدارة الأصناف', 'edit_products': 'تعديل الأصناف', 'delete_products': 'حذف الأصناف',
        'manage_users': 'إدارة المستخدمين', 'manage_settings': 'إعدادات النظام', 
        'view_reports': 'عرض التقارير', 'backup_restore': 'نسخ احتياطي', 'reset_system': 'إعادة تعيين'
    };
    
    let html = '';
    for (let group in groups) {
        html += `<h4 style="margin-top:10px;">${group}</h4><div style="display:flex; flex-wrap:wrap; gap:8px;">`;
        for (let perm of groups[group]) {
            const checked = currentPermissions.includes(perm) ? 'checked' : '';
            html += `<label><input type="checkbox" class="permCheck" value="${perm}" ${checked}> ${labels[perm] || perm}</label>`;
        }
        html += '</div>';
    }
    return html;
}

function addUserForm() {
    content.innerHTML = `
        <div class="card">
            <h2>إضافة مستخدم</h2>
            <label>اسم المستخدم</label>
            <input id="newUsername">
            <label>كلمة المرور</label>
            <input id="newPassword" type="password">
            <label>الصلاحيات</label>
            <div id="permissionsArea">${getPermissionsHTML()}</div>
            <br>
            <button onclick="saveNewUser()">حفظ</button>
            <button onclick="usersManagementPage()">إلغاء</button>
        </div>
    `;
}

function saveNewUser() {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    if (!username || !password) { alert('اسم المستخدم وكلمة المرور مطلوبان'); return; }
    const users = JSON.parse(localStorage.getItem('users')) || [];
    if (users.find(u => u.username === username)) { alert('اسم المستخدم موجود مسبقاً'); return; }
    
    const perms = [];
    document.querySelectorAll('.permCheck:checked').forEach(cb => perms.push(cb.value));
    
    const hashedPassword = CryptoJS.SHA256(password).toString();
    users.push({ username, password: hashedPassword, role: 'user', permissions: perms });
    localStorage.setItem('users', JSON.stringify(users));
    alert('تم إضافة المستخدم بنجاح');
    usersManagementPage();
}

function editUserForm(index) {
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users[index];
    if (!user) return;
    const currentPerms = user.permissions || [];
    
    content.innerHTML = `
        <div class="card">
            <h2>تعديل مستخدم</h2>
            <label>اسم المستخدم (لا يمكن تغييره)</label>
            <input value="${user.username}" disabled>
            <label>كلمة مرور جديدة (اترك فارغاً إذا لا تريد التغيير)</label>
            <input id="editPassword" type="password" placeholder="كلمة مرور جديدة">
            <label>الصلاحيات</label>
            <div id="permissionsArea">${getPermissionsHTML(currentPerms)}</div>
            <br>
            <button onclick="saveUserEdit(${index})">حفظ</button>
            <button onclick="usersManagementPage()">إلغاء</button>
        </div>
    `;
}

function saveUserEdit(index) {
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users[index];
    if (!user) return;
    
    const newPassword = document.getElementById('editPassword').value.trim();
    if (newPassword) user.password = CryptoJS.SHA256(newPassword).toString();
    
    const perms = [];
    document.querySelectorAll('.permCheck:checked').forEach(cb => perms.push(cb.value));
    user.permissions = perms;
    // تأكد أن المدير يبقى له كل الصلاحيات
    if (user.role === 'admin') user.permissions = [...allPermissions];
    
    localStorage.setItem('users', JSON.stringify(users));
    alert('تم تعديل المستخدم بنجاح');
    usersManagementPage();
}

function deleteUser(index) {
    const users = JSON.parse(localStorage.getItem('users')) || [];
    if (users.length <= 1) { alert('لا يمكن حذف آخر مستخدم'); return; }
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
    users.splice(index, 1);
    localStorage.setItem('users', JSON.stringify(users));
    alert('تم الحذف');
    usersManagementPage();
}

// ======================== إدارة العملات (بدون تغيير) ========================
function currencyManagementPage() {
    const currencies = JSON.parse(localStorage.getItem('currencies')) || window.currencies || [];
    let rows = '';
    currencies.forEach(c => {
        rows += `<tr>
            <td>${c.code}</td><td>${c.name}</td><td>${c.symbol}</td><td>${c.rate}</td>
            <td>${c.default ? '✅' : ''}</td>
            <td>
                <button onclick="editCurrencyForm(${c.id})">تعديل</button>
                <button onclick="deleteCurrency(${c.id})">حذف</button>
            </td>
        </tr>`;
    });
    content.innerHTML = `
        <div class="card">
            <h2>أسعار الصرف</h2>
            <button onclick="addCurrencyForm()">➕ إضافة عملة</button>
        </div>
        <div class="card">
            <table>
                <tr><th>الكود</th><th>الاسم</th><th>الرمز</th><th>السعر</th><th>الافتراضي</th><th>إجراءات</th></tr>
                ${rows}
            </table>
            <button onclick="settingsPage()">رجوع</button>
        </div>
    `;
}

function addCurrencyForm() {
    content.innerHTML = `
        <div class="card">
            <h2>إضافة عملة</h2>
            <label>الكود</label><input id="currencyCode" placeholder="مثال: USD">
            <label>الاسم</label><input id="currencyName" placeholder="مثال: دولار أمريكي">
            <label>الرمز</label><input id="currencySymbol" placeholder="مثال: $">
            <label>سعر الصرف</label><input id="currencyRate" type="number" value="1">
            <label><input type="checkbox" id="currencyDefault"> تعيين كافتراضي</label>
            <br><br>
            <button onclick="saveNewCurrency()">حفظ</button>
            <button onclick="currencyManagementPage()">إلغاء</button>
        </div>
    `;
}

function saveNewCurrency() {
    const currencies = JSON.parse(localStorage.getItem('currencies')) || window.currencies || [];
    const code = document.getElementById('currencyCode').value.trim();
    const name = document.getElementById('currencyName').value.trim();
    const symbol = document.getElementById('currencySymbol').value.trim();
    const rate = parseFloat(document.getElementById('currencyRate').value) || 1;
    const isDefault = document.getElementById('currencyDefault').checked;
    if (!code || !name) { alert('الكود والاسم مطلوبان'); return; }
    const newId = currencies.length ? Math.max(...currencies.map(c => c.id)) + 1 : 1;
    if (isDefault) currencies.forEach(c => c.default = false);
    currencies.push({ id: newId, code, name, symbol, rate, default: isDefault });
    localStorage.setItem('currencies', JSON.stringify(currencies));
    window.currencies = currencies;
    alert('تم إضافة العملة');
    currencyManagementPage();
}

function editCurrencyForm(id) {
    const currencies = JSON.parse(localStorage.getItem('currencies')) || window.currencies || [];
    const c = currencies.find(c => c.id === id);
    if (!c) return;
    content.innerHTML = `
        <div class="card">
            <h2>تعديل عملة</h2>
            <label>الكود</label><input id="editCurrencyCode" value="${c.code}">
            <label>الاسم</label><input id="editCurrencyName" value="${c.name}">
            <label>الرمز</label><input id="editCurrencySymbol" value="${c.symbol}">
            <label>سعر الصرف</label><input id="editCurrencyRate" type="number" value="${c.rate}">
            <label><input type="checkbox" id="editCurrencyDefault" ${c.default ? 'checked' : ''}> تعيين كافتراضي</label>
            <br><br>
            <button onclick="saveCurrencyEdit(${id})">حفظ</button>
            <button onclick="currencyManagementPage()">إلغاء</button>
        </div>
    `;
}

function saveCurrencyEdit(id) {
    const currencies = JSON.parse(localStorage.getItem('currencies')) || window.currencies || [];
    const c = currencies.find(c => c.id === id);
    if (!c) return;
    c.code = document.getElementById('editCurrencyCode').value.trim();
    c.name = document.getElementById('editCurrencyName').value.trim();
    c.symbol = document.getElementById('editCurrencySymbol').value.trim();
    c.rate = parseFloat(document.getElementById('editCurrencyRate').value) || 1;
    const isDefault = document.getElementById('editCurrencyDefault').checked;
    if (isDefault) currencies.forEach(cc => cc.default = false);
    c.default = isDefault;
    localStorage.setItem('currencies', JSON.stringify(currencies));
    window.currencies = currencies;
    alert('تم تعديل العملة');
    currencyManagementPage();
}

function deleteCurrency(id) {
    const currencies = JSON.parse(localStorage.getItem('currencies')) || window.currencies || [];
    if (currencies.length <= 1) { alert('لا يمكن حذف آخر عملة'); return; }
    if (!confirm('حذف العملة؟')) return;
    const updated = currencies.filter(c => c.id !== id);
    localStorage.setItem('currencies', JSON.stringify(updated));
    window.currencies = updated;
    alert('تم الحذف');
    currencyManagementPage();
}
function openBalanceRebuild() {
    if (typeof runBalanceRebuild === 'function') {
        runBalanceRebuild();
    } else {
        alert('وحدة إعادة بناء الأرصدة غير محملة');
    }
}

window.openBalanceRebuild = openBalanceRebuild;

// تعريض الدوال
window.settingsPage = settingsPage;
window.companySettingsForm = companySettingsForm;
window.previewLogo = previewLogo;
window.previewStamp = previewStamp;
window.saveCompanySettings = saveCompanySettings;
window.usersManagementPage = usersManagementPage;
window.addUserForm = addUserForm;
window.saveNewUser = saveNewUser;
window.editUserForm = editUserForm;
window.saveUserEdit = saveUserEdit;
window.deleteUser = deleteUser;
window.currencyManagementPage = currencyManagementPage;
window.addCurrencyForm = addCurrencyForm;
window.saveNewCurrency = saveNewCurrency;
window.editCurrencyForm = editCurrencyForm;
window.saveCurrencyEdit = saveCurrencyEdit;
window.deleteCurrency = deleteCurrency;
