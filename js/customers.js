// customers.js - وحدة إدارة العملاء (نسخة SQLite)
console.log('👥 تحميل وحدة العملاء...');

// ======================== دوال مساعدة ========================
function getCustomersList() {
    return query(`
        SELECT p.id, p.code, p.name, p.phone, p.address, p.account_id, p.current_balance
        FROM partners p
        WHERE p.type IN ('Customer','Both') AND p.deleted = 0
        ORDER BY p.name
    `);
}

function getCustomerBalance(customerId) {
    const result = query(`SELECT current_balance FROM partners WHERE id = ?`, [customerId]);
    return result.length ? result[0][0] : 0;
}

// ======================== الصفحة الرئيسية ========================
function customersPage() {
    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-users"></i> إدارة العملاء</h2>
            <input id="searchCustomer" placeholder="بحث بالاسم أو الهاتف" onkeyup="searchCustomer()">
        </div>
        <div class="card">
            <button onclick="newCustomer()"><i class="fas fa-plus"></i> إضافة عميل</button>
        </div>
        <div class="card">
            <div id="customersTable"></div>
        </div>
    `;
    renderCustomersTable();
}

function renderCustomersTable(list = null) {
    const customers = list || getCustomersList();
    
    let rows = '';
    customers.forEach(c => {
        const id = c[0];
        const code = c[1];
        const name = c[2];
        const phone = c[3] || '-';
        const address = c[4] || '-';
        const balance = c[6] || 0;
        
        rows += `<tr>
            <td>${name}</td>
            <td>${phone}</td>
            <td>${address}</td>
            <td>${formatMoney(balance)}</td>
            <td>
                <button onclick="customerStatement(${id})">كشف حساب</button>
                <button onclick="editCustomer(${id})">تعديل</button>
                <button onclick="deleteCustomer(${id})">حذف</button>
            </td>
        </tr>`;
    });
    
    document.getElementById('customersTable').innerHTML = `
        <table>
            <tr><th>الاسم</th><th>الهاتف</th><th>العنوان</th><th>الرصيد</th><th>العمليات</th></tr>
            ${rows || '<tr><td colspan="5">لا يوجد عملاء</td></tr>'}
        </table>
    `;
}

function searchCustomer() {
    const q = document.getElementById('searchCustomer').value.toLowerCase();
    const filtered = query(`
        SELECT p.id, p.code, p.name, p.phone, p.address, p.account_id, p.current_balance
        FROM partners p
        WHERE p.type IN ('Customer','Both') AND p.deleted = 0
          AND (LOWER(p.name) LIKE ? OR LOWER(p.phone) LIKE ?)
        ORDER BY p.name
    `, [`%${q}%`, `%${q}%`]);
    renderCustomersTable(filtered);
}

// ======================== إضافة عميل ========================
function newCustomer() {
    content.innerHTML = `
        <div class="card">
            <h3>إضافة عميل</h3>
            <input id="cName" placeholder="اسم العميل">
            <input id="cPhone" placeholder="الهاتف">
            <input id="cAddress" placeholder="العنوان">
            <button onclick="saveCustomer()">حفظ</button>
            <button onclick="customersPage()">إلغاء</button>
        </div>
    `;
}

function saveCustomer() {
    const name = document.getElementById('cName').value.trim();
    const phone = document.getElementById('cPhone').value.trim();
    const address = document.getElementById('cAddress').value.trim();
    
    if (!name) { alert('أدخل اسم العميل'); return; }
    
    // توليد كود العميل
    const lastCode = query(`SELECT code FROM partners WHERE type IN ('Customer','Both') ORDER BY id DESC LIMIT 1`);
    let nextCode = 'C0001';
    if (lastCode.length) {
        const num = parseInt(lastCode[0][0].substring(1)) + 1;
        nextCode = 'C' + String(num).padStart(4, '0');
    }
    
    // إنشاء حساب للعميل تحت 1130
    const accountId = window.createAccountForCustomer(name);
if (accountId === -1 || accountId === undefined || accountId === null || accountId <= 0) {
    alert('فشل في إنشاء حساب العميل (القيمة المستلمة: ' + accountId + ')');
    return;
}
    
    // حفظ العميل
    run(`
        INSERT INTO partners (code, name, phone, address, type, account_id)
        VALUES (?, ?, ?, ?, 'Customer', ?)
    `, [nextCode, name, phone, address, accountId]);
    
    saveDatabase();
    addLog('إضافة عميل', name);
    alert('تم إضافة العميل بنجاح');
    customersPage();
}

// ======================== تعديل عميل ========================
function editCustomer(id) {
    const c = query(`SELECT name, phone, address FROM partners WHERE id = ?`, [id])[0];
    if (!c) return;
    
    content.innerHTML = `
        <div class="card">
            <h3>تعديل العميل</h3>
            <input id="cName" value="${c[0]}">
            <input id="cPhone" value="${c[1] || ''}">
            <input id="cAddress" value="${c[2] || ''}">
            <button onclick="updateCustomer(${id})">حفظ</button>
            <button onclick="customersPage()">إلغاء</button>
        </div>
    `;
}

function updateCustomer(id) {
    const name = document.getElementById('cName').value.trim();
    const phone = document.getElementById('cPhone').value.trim();
    const address = document.getElementById('cAddress').value.trim();
    
    if (!name) { alert('أدخل اسم العميل'); return; }
    
    run(`UPDATE partners SET name = ?, phone = ?, address = ? WHERE id = ?`, [name, phone, address, id]);
    saveDatabase();
    addLog('تعديل عميل', name);
    alert('تم تعديل العميل');
    customersPage();
}

// ======================== حذف عميل ========================
function deleteCustomer(id) {
    // التحقق من وجود عمليات مرتبطة
    const hasInvoices = query(`SELECT COUNT(*) FROM sales_invoices WHERE customer_id = ? AND status != 'Deleted'`, [id])[0][0];
    const hasReturns = query(`SELECT COUNT(*) FROM sales_returns WHERE customer_id = ? AND status != 'Deleted'`, [id])[0][0];
    
    if (hasInvoices > 0 || hasReturns > 0) {
        alert('لا يمكن حذف العميل لوجود فواتير أو مرتجعات مرتبطة');
        return;
    }
    
    if (!confirm('هل تريد حذف العميل؟')) return;
    
    run(`UPDATE partners SET deleted = 1 WHERE id = ?`, [id]);
    saveDatabase();
    addLog('حذف عميل', id);
    alert('تم حذف العميل');
    customersPage();
}

// ======================== كشف حساب العميل ========================
function customerStatement(id) {
    const customer = query(`SELECT name FROM partners WHERE id = ?`, [id])[0];
    if (!customer) return;
    
    const transactions = [];
    
    // فواتير المبيعات
const invoices = query(`
    SELECT date, invoice_number, total FROM sales_invoices
    WHERE customer_id = ? AND status = 'Posted' AND type != 'cash'
`, [id]);
    invoices.forEach(inv => {
        transactions.push({
            date: inv[0],
            type: 'فاتورة مبيعات',
            number: inv[1],
            debit: inv[2],
            credit: 0
        });
    });
    
    // مرتجعات المبيعات
    const returns = query(`
        SELECT date, return_number, total FROM sales_returns
        WHERE customer_id = ? AND status = 'Posted'
    `, [id]);
    returns.forEach(ret => {
        transactions.push({
            date: ret[0],
            type: 'مرتجع مبيعات',
            number: ret[1],
            debit: 0,
            credit: ret[2]
        });
    });
    
    // سندات القبض
    const receipts = query(`
        SELECT v.date, v.voucher_number, v.amount
        FROM vouchers v
        JOIN partners p ON v.account_id = p.account_id
        WHERE p.id = ? AND v.voucher_type = 'Receipt' AND v.status = 'Posted'
    `, [id]);
    receipts.forEach(rec => {
        transactions.push({
            date: rec[0],
            type: 'سند قبض',
            number: rec[1],
            debit: 0,
            credit: rec[2]
        });
    });
    
    // ترتيب حسب التاريخ
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let rows = '';
    let balance = 0;
    transactions.forEach(t => {
        balance += t.debit - t.credit;
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
            <h3>كشف حساب العميل: ${customer[0]}</h3>
            <table>
                <tr><th>التاريخ</th><th>العملية</th><th>الرقم</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr>
                ${rows || '<tr><td colspan="6">لا توجد عمليات</td></tr>'}
            </table>
            <h3>الرصيد الحالي: ${formatMoney(balance)}</h3>
            <button onclick="openCustomerStatement(${id})">فتح / طباعة</button>
            <button onclick="customersPage()">رجوع</button>
        </div>
    `;
}

function openCustomerStatement(id) {
    const customer = query(`SELECT name FROM partners WHERE id = ?`, [id])[0];
    if (!customer) return;
    
    const transactions = [];
const invoices = query(`SELECT date, invoice_number, total FROM sales_invoices WHERE customer_id = ? AND status = 'Posted' AND type != 'cash'`, [id]);
    invoices.forEach(inv => transactions.push({ date: inv[0], type: 'فاتورة مبيعات', number: inv[1], debit: inv[2], credit: 0 }));
    const returns = query(`SELECT date, return_number, total FROM sales_returns WHERE customer_id = ? AND status = 'Posted'`, [id]);
    returns.forEach(ret => transactions.push({ date: ret[0], type: 'مرتجع', number: ret[1], debit: 0, credit: ret[2] }));
    const receipts = query(`
        SELECT v.date, v.voucher_number, v.amount
        FROM vouchers v
        JOIN partners p ON v.account_id = p.account_id
        WHERE p.id = ? AND v.voucher_type = 'Receipt' AND v.status = 'Posted'
    `, [id]);
    receipts.forEach(rec => transactions.push({ date: rec[0], type: 'سند قبض', number: rec[1], debit: 0, credit: rec[2] }));
    
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let rows = '';
    let balance = 0;
    transactions.forEach((t, idx) => {
        balance += t.debit - t.credit;
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
            <div class="title">كشف حساب عميل</div>
            <p><strong>العميل:</strong> ${customer[0]}</p>
            <table>
                <tr><th>#</th><th>التاريخ</th><th>العملية</th><th>الرقم</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr>
                ${rows}
            </table>
            <div class="total">الرصيد النهائي: ${balance}</div>
            <div style="text-align:center;margin-top:20px;"><canvas id="qrcode"></canvas></div>
            <div class="footer">
                <div>توقيع المحاسب<br><br>------</div>
                <div>توقيع العميل<br><br>------</div>
                <div>${company.stamp ? `<img src="${company.stamp}" style="height:80px">` : ''}</div>
            </div>
            <p>تاريخ الطباعة: ${new Date().toLocaleString()}</p>
        </body></html>
    `;
    
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    
    setTimeout(() => {
        const qrText = JSON.stringify({ type: 'customer_statement', name: customer[0], balance, generated: new Date().toISOString() });
        const canvas = win.document.getElementById('qrcode');
        if (canvas && typeof QRCode !== 'undefined') QRCode.toCanvas(canvas, qrText);
    }, 500);
}

// تعريض الدوال
window.customersPage = customersPage;
window.newCustomer = newCustomer;
window.saveCustomer = saveCustomer;
window.editCustomer = editCustomer;
window.updateCustomer = updateCustomer;
window.deleteCustomer = deleteCustomer;
window.customerStatement = customerStatement;
window.openCustomerStatement = openCustomerStatement;
window.searchCustomer = searchCustomer;
window.renderCustomersTable = renderCustomersTable;
