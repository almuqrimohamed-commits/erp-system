// suppliers.js - وحدة إدارة الموردين (نسخة SQLite)
console.log('🚚 تحميل وحدة الموردين...');

// ======================== دوال مساعدة ========================
function getSuppliersList() {
    return query(`
        SELECT p.id, p.code, p.name, p.phone, p.address, p.account_id, p.current_balance
        FROM partners p
        WHERE p.type IN ('Supplier','Both') AND p.deleted = 0
        ORDER BY p.name
    `);
}

function getSupplierBalance(supplierId) {
    const result = query(`SELECT current_balance FROM partners WHERE id = ?`, [supplierId]);
    return result.length ? result[0][0] : 0;
}

// ======================== الصفحة الرئيسية ========================
function suppliersPage() {
    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-truck"></i> إدارة الموردين</h2>
            <input id="searchSupplier" placeholder="بحث بالاسم أو الهاتف" onkeyup="searchSupplier()">
        </div>
        <div class="card">
            <button onclick="newSupplier()"><i class="fas fa-plus"></i> إضافة مورد</button>
        </div>
        <div class="card">
            <div id="suppliersTable"></div>
        </div>
    `;
    renderSuppliersTable();
}

function renderSuppliersTable(list = null) {
    const suppliers = list || getSuppliersList();
    
    let rows = '';
    suppliers.forEach(s => {
        const id = s[0];
        const code = s[1];
        const name = s[2];
        const phone = s[3] || '-';
        const address = s[4] || '-';
        const balance = s[6] || 0;
        
        rows += `<tr>
            <td>${name}</td>
            <td>${phone}</td>
            <td>${address}</td>
            <td>${formatMoney(balance)}</td>
            <td>
                <button onclick="supplierStatement(${id})">كشف حساب</button>
                <button onclick="editSupplier(${id})">تعديل</button>
                <button onclick="deleteSupplier(${id})">حذف</button>
            </td>
        </tr>`;
    });
    
    document.getElementById('suppliersTable').innerHTML = `
        <table>
            <tr><th>الاسم</th><th>الهاتف</th><th>العنوان</th><th>الرصيد</th><th>العمليات</th></tr>
            ${rows || '<tr><td colspan="5">لا يوجد موردين</td></tr>'}
        </table>
    `;
}

function searchSupplier() {
    const q = document.getElementById('searchSupplier').value.toLowerCase();
    const filtered = query(`
        SELECT p.id, p.code, p.name, p.phone, p.address, p.account_id, p.current_balance
        FROM partners p
        WHERE p.type IN ('Supplier','Both') AND p.deleted = 0
          AND (LOWER(p.name) LIKE ? OR LOWER(p.phone) LIKE ?)
        ORDER BY p.name
    `, [`%${q}%`, `%${q}%`]);
    renderSuppliersTable(filtered);
}

// ======================== إضافة مورد ========================
function newSupplier() {
    content.innerHTML = `
        <div class="card">
            <h3>إضافة مورد</h3>
            <input id="sName" placeholder="اسم المورد">
            <input id="sPhone" placeholder="الهاتف">
            <input id="sAddress" placeholder="العنوان">
            <button onclick="saveSupplier()">حفظ</button>
            <button onclick="suppliersPage()">إلغاء</button>
        </div>
    `;
}

function saveSupplier() {
    const name = document.getElementById('sName').value.trim();
    const phone = document.getElementById('sPhone').value.trim();
    const address = document.getElementById('sAddress').value.trim();
    
    if (!name) { alert('أدخل اسم المورد'); return; }
    
    // توليد كود المورد
    const lastCode = query(`SELECT code FROM partners WHERE type IN ('Supplier','Both') ORDER BY id DESC LIMIT 1`);
    let nextCode = 'S0001';
    if (lastCode.length) {
        const num = parseInt(lastCode[0][0].substring(1)) + 1;
        nextCode = 'S' + String(num).padStart(4, '0');
    }
    
    // إنشاء حساب للمورد تحت 2110
  const accountId = window.createAccountForSupplier(name);
if (accountId === -1 || accountId === undefined || accountId === null || accountId <= 0) {
    alert('فشل في إنشاء حساب المورد (القيمة المستلمة: ' + accountId + ')');
    return;
}
    
    // حفظ المورد
    run(`
        INSERT INTO partners (code, name, phone, address, type, account_id)
        VALUES (?, ?, ?, ?, 'Supplier', ?)
    `, [nextCode, name, phone, address, accountId]);
    
    saveDatabase();
    addLog('إضافة مورد', name);
    alert('تم إضافة المورد بنجاح');
    suppliersPage();
}

// ======================== تعديل مورد ========================
function editSupplier(id) {
    const s = query(`SELECT name, phone, address FROM partners WHERE id = ?`, [id])[0];
    if (!s) return;
    
    content.innerHTML = `
        <div class="card">
            <h3>تعديل المورد</h3>
            <input id="sName" value="${s[0]}">
            <input id="sPhone" value="${s[1] || ''}">
            <input id="sAddress" value="${s[2] || ''}">
            <button onclick="updateSupplier(${id})">حفظ</button>
            <button onclick="suppliersPage()">إلغاء</button>
        </div>
    `;
}

function updateSupplier(id) {
    const name = document.getElementById('sName').value.trim();
    const phone = document.getElementById('sPhone').value.trim();
    const address = document.getElementById('sAddress').value.trim();
    
    if (!name) { alert('أدخل اسم المورد'); return; }
    
    run(`UPDATE partners SET name = ?, phone = ?, address = ? WHERE id = ?`, [name, phone, address, id]);
    saveDatabase();
    addLog('تعديل مورد', name);
    alert('تم تعديل المورد');
    suppliersPage();
}

// ======================== حذف مورد ========================
function deleteSupplier(id) {
    // التحقق من وجود عمليات مرتبطة
    const hasPurchases = query(`SELECT COUNT(*) FROM purchase_invoices WHERE supplier_id = ? AND status != 'Deleted'`, [id])[0][0];
    const hasReturns = query(`SELECT COUNT(*) FROM purchase_returns WHERE supplier_id = ? AND status != 'Deleted'`, [id])[0][0];
    
    if (hasPurchases > 0 || hasReturns > 0) {
        alert('لا يمكن حذف المورد لوجود فواتير مشتريات أو مرتجعات مرتبطة');
        return;
    }
    
    if (!confirm('هل تريد حذف المورد؟')) return;
    
    run(`UPDATE partners SET deleted = 1 WHERE id = ?`, [id]);
    saveDatabase();
    addLog('حذف مورد', id);
    alert('تم حذف المورد');
    suppliersPage();
}

// ======================== كشف حساب المورد ========================
function supplierStatement(id) {
    const supplier = query(`SELECT name FROM partners WHERE id = ?`, [id])[0];
    if (!supplier) return;
    
    const transactions = [];
    
    // فواتير المشتريات (دائن)
const purchases = query(`
    SELECT date, invoice_number, total FROM purchase_invoices
    WHERE supplier_id = ? AND status = 'Posted' AND type != 'cash'
`, [id]);
    purchases.forEach(p => {
        transactions.push({
            date: p[0],
            type: 'فاتورة مشتريات',
            number: p[1],
            debit: 0,
            credit: p[2]
        });
    });
    
    // مرتجعات المشتريات (مدين)
    const returns = query(`
        SELECT date, return_number, total FROM purchase_returns
        WHERE supplier_id = ? AND status = 'Posted'
    `, [id]);
    returns.forEach(r => {
        transactions.push({
            date: r[0],
            type: 'مرتجع مشتريات',
            number: r[1],
            debit: r[2],
            credit: 0
        });
    });
    
    // سندات الصرف (مدين)
    const payments = query(`
        SELECT v.date, v.voucher_number, v.amount
        FROM vouchers v
        JOIN partners p ON v.account_id = p.account_id
        WHERE p.id = ? AND v.voucher_type = 'Payment' AND v.status = 'Posted'
    `, [id]);
    payments.forEach(p => {
        transactions.push({
            date: p[0],
            type: 'سند صرف',
            number: p[1],
            debit: p[2],
            credit: 0
        });
    });
    
    // ترتيب حسب التاريخ
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let rows = '';
    let balance = 0;
    transactions.forEach(t => {
        balance = balance + t.credit - t.debit;
        rows += `<tr>
            <td>${t.date}</td>
            <td>${t.type}</td>
            <td>${t.number}</td>
            <td>${t.debit ? formatMoney(t.debit) : ''}</td>
            <td>${t.credit ? formatMoney(t.credit) : ''}</td>
            <td>${formatMoney(balance)}</td>
        </tr>`;
    });
    
    content.innerHTML = `
        <div class="card">
            <h3>كشف حساب المورد: ${supplier[0]}</h3>
            <table>
                <tr><th>التاريخ</th><th>العملية</th><th>الرقم</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr>
                ${rows || '<tr><td colspan="6">لا توجد عمليات</td></tr>'}
            </table>
            <h3>الرصيد الحالي: ${formatMoney(balance)}</h3>
            <button onclick="openSupplierStatement(${id})">فتح / طباعة</button>
            <button onclick="suppliersPage()">رجوع</button>
        </div>
    `;
}

function openSupplierStatement(id) {
    const supplier = query(`SELECT name FROM partners WHERE id = ?`, [id])[0];
    if (!supplier) return;
    
    const transactions = [];
const purchases = query(`SELECT date, invoice_number, total FROM purchase_invoices WHERE supplier_id = ? AND status = 'Posted' AND type != 'cash'`, [id]);
    purchases.forEach(p => transactions.push({ date: p[0], type: 'فاتورة مشتريات', number: p[1], debit: 0, credit: p[2] }));
    const returns = query(`SELECT date, return_number, total FROM purchase_returns WHERE supplier_id = ? AND status = 'Posted'`, [id]);
    returns.forEach(r => transactions.push({ date: r[0], type: 'مرتجع مشتريات', number: r[1], debit: r[2], credit: 0 }));
    const payments = query(`
        SELECT v.date, v.voucher_number, v.amount
        FROM vouchers v
        JOIN partners p ON v.account_id = p.account_id
        WHERE p.id = ? AND v.voucher_type = 'Payment' AND v.status = 'Posted'
    `, [id]);
    payments.forEach(p => transactions.push({ date: p[0], type: 'سند صرف', number: p[1], debit: p[2], credit: 0 }));
    
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let rows = '';
    let balance = 0;
    transactions.forEach((t, idx) => {
        balance = balance + t.credit - t.debit;
        rows += `<tr>
            <td>${idx + 1}</td>
            <td>${t.date}</td>
            <td>${t.type}</td>
            <td>${t.number}</td>
            <td>${t.debit || ''}</td>
            <td>${t.credit || ''}</td>
            <td>${balance}</td>
        </tr>`;
    });
    
    const html = `
        <html><head><meta charset="UTF-8"><style>
            body{font-family:Tahoma;direction:rtl;padding:20px;}
            @page{size:A4;margin:20mm;}
            .header{display:flex;justify-content:space-between;border-bottom:2px solid #000;margin-bottom:20px;}
            .logo img{height:80px;}
            .title{text-align:center;font-size:22px;font-weight:bold;margin:15px 0;}
            table{width:100%;border-collapse:collapse;}
            th,td{border:1px solid #000;padding:8px;text-align:center;}
            th{background:#eee;}
            .total{text-align:left;margin-top:15px;font-size:18px;font-weight:bold;}
            .footer{margin-top:40px;display:flex;justify-content:space-between;}
        </style></head>
        <body>
            <div class="header">
                <div><h2>${company.name}</h2><p>${company.phone}</p><p>${company.address}</p></div>
                <div class="logo">${company.logo ? `<img src="${company.logo}">` : ''}</div>
            </div>
            <div class="title">كشف حساب مورد</div>
            <p><strong>المورد:</strong> ${supplier[0]}</p>
            <table>
                <tr><th>#</th><th>التاريخ</th><th>العملية</th><th>الرقم</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr>
                ${rows}
            </table>
            <div class="total">الرصيد النهائي: ${balance}</div>
            <div style="text-align:center;margin-top:20px;"><canvas id="qrcode"></canvas></div>
            <div class="footer">
                <div>توقيع المحاسب<br><br>------</div>
                <div>توقيع المورد<br><br>------</div>
                <div>${company.stamp ? `<img src="${company.stamp}" style="height:80px">` : ''}</div>
            </div>
            <p>تاريخ الطباعة: ${new Date().toLocaleString()}</p>
        </body></html>
    `;
    
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    
    setTimeout(() => {
        const qrText = JSON.stringify({ type: 'supplier_statement', name: supplier[0], balance, generated: new Date().toISOString() });
        const canvas = win.document.getElementById('qrcode');
        if (canvas && typeof QRCode !== 'undefined') QRCode.toCanvas(canvas, qrText);
    }, 500);
}

// تعريض الدوال
window.suppliersPage = suppliersPage;
window.newSupplier = newSupplier;
window.saveSupplier = saveSupplier;
window.editSupplier = editSupplier;
window.updateSupplier = updateSupplier;
window.deleteSupplier = deleteSupplier;
window.supplierStatement = supplierStatement;
window.openSupplierStatement = openSupplierStatement;
window.searchSupplier = searchSupplier;
window.renderSuppliersTable = renderSuppliersTable;
