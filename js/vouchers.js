// vouchers.js - وحدة السندات (نسخة SQLite - معدلة بالكامل)
console.log('🧾 تحميل وحدة السندات...');

// ======================== دوال تهيئة ========================
function initVouchers() {
    ensureVoucherSchema();
}

function ensureVoucherSchema() {
    const columns = [
        { name: 'ref', type: 'TEXT' },
        { name: 'currency_id', type: 'INTEGER' },
        { name: 'amount_words', type: 'TEXT' },
        { name: 'voucher_type', type: 'TEXT DEFAULT \'Receipt\'' },
        { name: 'account_id', type: 'INTEGER' },
        { name: 'cash_account_id', type: 'INTEGER' },
        { name: 'debit_account_id', type: 'INTEGER' },
        { name: 'credit_account_id', type: 'INTEGER' },
        { name: 'advance_type', type: 'TEXT' },
        { name: 'deleted', type: 'INTEGER DEFAULT 0' }
    ];
    columns.forEach(col => {
        try { run(`ALTER TABLE vouchers ADD COLUMN ${col.name} ${col.type}`); } catch(e) {}
    });
}

// ======================== دوال مساعدة ========================
function getNextVoucherNumber(prefix) {
    const result = query(`SELECT voucher_number FROM vouchers WHERE voucher_number LIKE ? ORDER BY id DESC LIMIT 1`, [`${prefix}%`]);
    if (!result.length) return `${prefix}000001`;
    const last = result[0][0];
    const num = parseInt(last.replace(prefix, '')) + 1;
    return prefix + String(num).padStart(6, '0');
}

function saveVoucher(voucher) {
    const stmt = db.prepare(`
        INSERT INTO vouchers 
        (voucher_number, date, ref, currency_id, amount, amount_words, description, 
         voucher_type, account_id, cash_account_id, debit_account_id, credit_account_id, advance_type, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Posted')
    `);
    stmt.run([
        voucher.number, voucher.date, voucher.ref || '', voucher.currencyId, voucher.amount,
        voucher.amountWords || '', voucher.description || '', voucher.voucher_type,
        voucher.accountId || null, voucher.cashAccountId || null, voucher.debitAccountId || null,
        voucher.creditAccountId || null, voucher.advanceType || null
    ]);
    stmt.free();
    saveDatabase();
}

function deleteVoucherLogically(id) {
    run(`UPDATE vouchers SET deleted = 1 WHERE id = ?`, [id]);
    saveDatabase();
}

function restoreVoucher(id) {
    run(`UPDATE vouchers SET deleted = 0 WHERE id = ?`, [id]);
    saveDatabase();
}

// ======================== صفحات القوائم ========================
function vouchersPage() {
    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-receipt"></i> السندات</h2>
            <button onclick="receiptsMenuPage()"><i class="fas fa-arrow-down"></i> سندات القبض</button>
            <button onclick="paymentsMenuPage()"><i class="fas fa-arrow-up"></i> سندات الصرف</button>
            <button onclick="advanceMenuPage()"><i class="fas fa-hand-holding-usd"></i> سندات العربون</button>
            <button onclick="settlementMenuPage()"><i class="fas fa-exchange-alt"></i> سندات التسوية</button>
            <br><br>
            <button onclick="dashboard()">↩️ رجوع</button>
        </div>
    `;
}

function receiptsMenuPage() {
    content.innerHTML = `
        <div class="card"><h2>سندات القبض</h2>
            <button onclick="addReceiptForm()">➕ إضافة سند قبض</button>
            <button onclick="receiptsListPage()">📋 عرض سندات القبض</button>
            <button onclick="deletedReceiptsPage()">🗑️ السندات المحذوفة</button>
            <br><br><button onclick="vouchersPage()">↩️ رجوع</button>
        </div>`;
}

function paymentsMenuPage() {
    content.innerHTML = `
        <div class="card"><h2>سندات الصرف</h2>
            <button onclick="addPaymentForm()">➕ إضافة سند صرف</button>
            <button onclick="paymentsListPage()">📋 عرض سندات الصرف</button>
            <button onclick="deletedPaymentsPage()">🗑️ السندات المحذوفة</button>
            <br><br><button onclick="vouchersPage()">↩️ رجوع</button>
        </div>`;
}

function advanceMenuPage() {
    content.innerHTML = `
        <div class="card"><h2>سندات العربون</h2>
            <button onclick="addAdvanceForm()">➕ إضافة سند عربون</button>
            <button onclick="advanceListPage()">📋 عرض سندات العربون</button>
            <button onclick="deletedAdvancePage()">🗑️ السندات المحذوفة</button>
            <br><br><button onclick="vouchersPage()">↩️ رجوع</button>
        </div>`;
}

function settlementMenuPage() {
    content.innerHTML = `
        <div class="card"><h2>سندات التسوية</h2>
            <button onclick="addSettlementForm()">➕ إضافة سند تسوية</button>
            <button onclick="settlementsListPage()">📋 عرض سندات التسوية</button>
            <button onclick="deletedSettlementPage()">🗑️ السندات المحذوفة</button>
            <br><br><button onclick="vouchersPage()">↩️ رجوع</button>
        </div>`;
}

// ======================== دوال العرض والطباعة ========================
function viewVoucher(type, id) {
    window.previewDocument(type, id);
}

// ======================== سندات القبض ========================
function addReceiptForm() {
    const nextNumber = getNextVoucherNumber('REC');
    const accountOptions = getAccountOptions();
    const cashOptions = getCashBankOptions();
    if (!cashOptions) { alert('لا يوجد حساب صندوق أو بنك'); return receiptsMenuPage(); }

    content.innerHTML = `
        <div class="card"><h2>إضافة سند قبض</h2>
            <label>رقم السند</label><input id="receiptNumber" value="${nextNumber}" readonly>
            <label>التاريخ</label><input id="receiptDate" type="date" value="${today()}">
            <label>مرجع</label><input id="receiptRef">
            <label>استلمنا من</label><select id="receiptAccount">${accountOptions}</select>
            <label>إلى الصندوق / البنك</label><select id="receiptCashAccount">${cashOptions}</select>
            <label>المبلغ</label><input id="receiptAmount" type="number" value="0" oninput="updateAmountWords()">
            <label>المبلغ كتابة</label><input id="amountWords" readonly>
            <label>العملة</label><select id="currencyId">${getCurrencyOptions()}</select>
            <label>البيان</label><input id="receiptDescription">
            <br><br>
            <button onclick="saveReceipt()">حفظ</button> <button onclick="receiptsMenuPage()">رجوع</button>
        </div>`;
    updateAmountWords();
}

function saveReceipt() {
    const voucher = {
        number: document.getElementById('receiptNumber').value,
        date: document.getElementById('receiptDate').value,
        ref: document.getElementById('receiptRef').value,
        accountId: Number(document.getElementById('receiptAccount').value),
        cashAccountId: Number(document.getElementById('receiptCashAccount').value),
        amount: Number(document.getElementById('receiptAmount').value),
        amountWords: document.getElementById('amountWords').value,
        currencyId: Number(document.getElementById('currencyId').value),
        description: document.getElementById('receiptDescription').value,
        voucher_type: 'Receipt'
    };
    if (voucher.amount <= 0) { alert('المبلغ غير صحيح'); return; }
    if (voucher.accountId === voucher.cashAccountId) { alert('لا يمكن اختيار نفس الحساب'); return; }

    saveVoucher(voucher);
    window.updateAccountBalance(voucher.cashAccountId, voucher.amount, 'debit');
    window.updateAccountBalance(voucher.accountId, voucher.amount, 'credit');
    addLog('إضافة سند قبض', voucher.number);
    alert('تم الحفظ');
    receiptsListPage();
}

function receiptsListPage() {
    const rows = queryVouchers('Receipt', false);
    content.innerHTML = `
        <div class="card"><h2>قائمة سندات القبض</h2><input id="receiptSearch" placeholder="بحث" oninput="searchReceipts()"><br><br>
        <button onclick="receiptsMenuPage()">رجوع</button></div>
        <div class="card"><table id="receiptsTable">${renderVoucherTable(rows)}</table></div>`;
}

function searchReceipts() {
    const text = document.getElementById('receiptSearch').value.toLowerCase();
    const all = queryVouchers('Receipt', false);
    const filtered = all.filter(v => 
        v.number.toLowerCase().includes(text) || v.date.includes(text) || v.accountName.includes(text) || v.cashAccountName.includes(text)
    );
    document.getElementById('receiptsTable').innerHTML = renderVoucherTable(filtered);
}

function deletedReceiptsPage() {
    const rows = queryVouchers('Receipt', true);
    content.innerHTML = `
        <div class="card"><h2>سندات القبض المحذوفة</h2><button onclick="receiptsListPage()">رجوع</button></div>
        <div class="card"><table>${renderDeletedVoucherTable(rows)}</table></div>`;
}

// ======================== سندات الصرف ========================
function addPaymentForm() {
    const nextNumber = getNextVoucherNumber('PAY');
    const accountOptions = getAccountOptions();
    const cashOptions = getCashBankOptions();
    if (!cashOptions) { alert('لا يوجد حساب صندوق أو بنك'); return paymentsMenuPage(); }

    content.innerHTML = `
        <div class="card"><h2>إضافة سند صرف</h2>
            <label>رقم السند</label><input id="paymentNumber" value="${nextNumber}" readonly>
            <label>التاريخ</label><input id="paymentDate" type="date" value="${today()}">
            <label>مرجع</label><input id="paymentRef">
            <label>صرفنا إلى</label><select id="paymentAccount">${accountOptions}</select>
            <label>من الصندوق / البنك</label><select id="paymentCashAccount">${cashOptions}</select>
            <label>المبلغ</label><input id="paymentAmount" type="number" value="0" oninput="updatePaymentAmountWords()">
            <label>المبلغ كتابة</label><input id="paymentAmountWords" readonly>
            <label>العملة</label><select id="paymentCurrency">${getCurrencyOptions()}</select>
            <label>البيان</label><input id="paymentDescription">
            <br><br>
            <button onclick="savePayment()">حفظ</button> <button onclick="paymentsMenuPage()">رجوع</button>
        </div>`;
}

function savePayment() {
    const voucher = {
        number: document.getElementById('paymentNumber').value,
        date: document.getElementById('paymentDate').value,
        ref: document.getElementById('paymentRef').value,
        accountId: Number(document.getElementById('paymentAccount').value),
        cashAccountId: Number(document.getElementById('paymentCashAccount').value),
        amount: Number(document.getElementById('paymentAmount').value),
        amountWords: document.getElementById('paymentAmountWords').value,
        currencyId: Number(document.getElementById('paymentCurrency').value),
        description: document.getElementById('paymentDescription').value,
        voucher_type: 'Payment'
    };
    if (voucher.amount <= 0) { alert('المبلغ غير صحيح'); return; }
    saveVoucher(voucher);
    window.updateAccountBalance(voucher.accountId, voucher.amount, 'debit');
    window.updateAccountBalance(voucher.cashAccountId, voucher.amount, 'credit');
    addLog('إضافة سند صرف', voucher.number);
    alert('تم الحفظ');
    paymentsListPage();
}

function paymentsListPage() {
    const rows = queryVouchers('Payment', false);
    content.innerHTML = `
        <div class="card"><h2>قائمة سندات الصرف</h2><input id="paymentSearch" placeholder="بحث" oninput="searchPayments()"><br><br>
        <button onclick="paymentsMenuPage()">رجوع</button></div>
        <div class="card"><table id="paymentsTable">${renderVoucherTable(rows)}</table></div>`;
}

function searchPayments() {
    const text = document.getElementById('paymentSearch').value.toLowerCase();
    const all = queryVouchers('Payment', false);
    const filtered = all.filter(v => 
        v.number.toLowerCase().includes(text) || v.date.includes(text) || v.accountName.includes(text) || v.cashAccountName.includes(text)
    );
    document.getElementById('paymentsTable').innerHTML = renderVoucherTable(filtered);
}

function deletedPaymentsPage() {
    const rows = queryVouchers('Payment', true);
    content.innerHTML = `
        <div class="card"><h2>سندات الصرف المحذوفة</h2><button onclick="paymentsListPage()">رجوع</button></div>
        <div class="card"><table>${renderDeletedVoucherTable(rows)}</table></div>`;
}

// ======================== سندات العربون ========================
function addAdvanceForm() {
    const nextNumber = getNextVoucherNumber('ADV');
    const accountOptions = getAccountOptions();
    const cashOptions = getCashBankOptions();
    content.innerHTML = `
        <div class="card"><h2>إضافة سند عربون</h2>
            <label>رقم السند</label><input id="advanceNumber" value="${nextNumber}" readonly>
            <label>التاريخ</label><input id="advanceDate" type="date" value="${today()}">
            <label>نوع العملية</label><select id="advanceType"><option value="received">عربون مقبوض</option><option value="paid">عربون مدفوع</option></select>
            <label>الحساب</label><select id="advanceAccount">${accountOptions}</select>
            <label>حساب الصندوق / البنك</label><select id="advanceCashAccount">${cashOptions}</select>
            <label>المبلغ</label><input id="advanceAmount" type="number" value="0" oninput="updateAdvanceAmountWords()">
            <label>المبلغ كتابة</label><input id="advanceAmountWords" readonly>
            <label>العملة</label><select id="advanceCurrency">${getCurrencyOptions()}</select>
            <label>البيان</label><input id="advanceDescription">
            <br><br>
            <button onclick="saveAdvance()">حفظ</button> <button onclick="advanceMenuPage()">رجوع</button>
        </div>`;
}

function saveAdvance() {
    const type = document.getElementById('advanceType').value;
    const voucher = {
        number: document.getElementById('advanceNumber').value,
        date: document.getElementById('advanceDate').value,
        accountId: Number(document.getElementById('advanceAccount').value),
        cashAccountId: Number(document.getElementById('advanceCashAccount').value),
        amount: Number(document.getElementById('advanceAmount').value),
        amountWords: document.getElementById('advanceAmountWords').value,
        currencyId: Number(document.getElementById('advanceCurrency').value),
        description: document.getElementById('advanceDescription').value,
        voucher_type: 'Advance',
        advanceType: type
    };
    if (voucher.amount <= 0) { alert('المبلغ غير صحيح'); return; }
    saveVoucher(voucher);
    if (type === 'received') {
        window.updateAccountBalance(voucher.cashAccountId, voucher.amount, 'debit');
        window.updateAccountBalance(voucher.accountId, voucher.amount, 'credit');
    } else {
        window.updateAccountBalance(voucher.accountId, voucher.amount, 'debit');
        window.updateAccountBalance(voucher.cashAccountId, voucher.amount, 'credit');
    }
    addLog('إضافة سند عربون', voucher.number);
    alert('تم الحفظ');
    advanceListPage();
}

function advanceListPage() {
    const rows = queryVouchers('Advance', false);
    content.innerHTML = `
        <div class="card"><h2>قائمة سندات العربون</h2><input id="advanceSearch" placeholder="بحث" oninput="searchAdvances()"><br><br>
        <button onclick="advanceMenuPage()">رجوع</button></div>
        <div class="card"><table id="advancesTable">${renderAdvanceTable(rows)}</table></div>`;
}

function searchAdvances() {
    const text = document.getElementById('advanceSearch').value.toLowerCase();
    const all = queryVouchers('Advance', false);
    const filtered = all.filter(v => 
        v.number.toLowerCase().includes(text) || v.date.includes(text) || v.accountName.includes(text)
    );
    document.getElementById('advancesTable').innerHTML = renderAdvanceTable(filtered);
}

function deletedAdvancePage() {
    const rows = queryVouchers('Advance', true);
    content.innerHTML = `
        <div class="card"><h2>سندات العربون المحذوفة</h2><button onclick="advanceListPage()">رجوع</button></div>
        <div class="card"><table>${renderDeletedAdvanceTable(rows)}</table></div>`;
}

// ======================== سندات التسوية ========================
function addSettlementForm() {
    const nextNumber = getNextVoucherNumber('STL');
    const accountOptions = getAccountOptions();
    content.innerHTML = `
        <div class="card"><h2>إضافة سند تسوية</h2>
            <label>رقم السند</label><input id="settlementNumber" value="${nextNumber}" readonly>
            <label>التاريخ</label><input id="settlementDate" type="date" value="${today()}">
            <label>الحساب المدين</label><select id="settlementDebitAccount">${accountOptions}</select>
            <label>الحساب الدائن</label><select id="settlementCreditAccount">${accountOptions}</select>
            <label>المبلغ</label><input id="settlementAmount" type="number" value="0" oninput="updateSettlementAmountWords()">
            <label>المبلغ كتابة</label><input id="settlementAmountWords" readonly>
            <label>العملة</label><select id="settlementCurrency">${getCurrencyOptions()}</select>
            <label>البيان</label><input id="settlementDescription">
            <br><br>
            <button onclick="saveSettlement()">حفظ</button> <button onclick="settlementMenuPage()">رجوع</button>
        </div>`;
}

function saveSettlement() {
    const voucher = {
        number: document.getElementById('settlementNumber').value,
        date: document.getElementById('settlementDate').value,
        debitAccountId: Number(document.getElementById('settlementDebitAccount').value),
        creditAccountId: Number(document.getElementById('settlementCreditAccount').value),
        amount: Number(document.getElementById('settlementAmount').value),
        amountWords: document.getElementById('settlementAmountWords').value,
        currencyId: Number(document.getElementById('settlementCurrency').value),
        description: document.getElementById('settlementDescription').value,
        voucher_type: 'Settlement'
    };
    if (voucher.amount <= 0) { alert('المبلغ غير صحيح'); return; }
    if (voucher.debitAccountId === voucher.creditAccountId) { alert('الحسابان متماثلان'); return; }
    saveVoucher(voucher);
    window.updateAccountBalance(voucher.debitAccountId, voucher.amount, 'debit');
    window.updateAccountBalance(voucher.creditAccountId, voucher.amount, 'credit');
    addLog('إضافة سند تسوية', voucher.number);
    alert('تم الحفظ');
    settlementsListPage();
}

function settlementsListPage() {
    const rows = queryVouchers('Settlement', false);
    content.innerHTML = `
        <div class="card"><h2>قائمة سندات التسوية</h2><input id="settlementSearch" placeholder="بحث" oninput="searchSettlements()"><br><br>
        <button onclick="settlementMenuPage()">رجوع</button></div>
        <div class="card"><table id="settlementsTable">${renderSettlementTable(rows)}</table></div>`;
}

function searchSettlements() {
    const text = document.getElementById('settlementSearch').value.toLowerCase();
    const all = queryVouchers('Settlement', false);
    const filtered = all.filter(v => 
        v.number.toLowerCase().includes(text) || v.date.includes(text) || v.debitAccountName.includes(text) || v.creditAccountName.includes(text)
    );
    document.getElementById('settlementsTable').innerHTML = renderSettlementTable(filtered);
}

function deletedSettlementPage() {
    const rows = queryVouchers('Settlement', true);
    content.innerHTML = `
        <div class="card"><h2>سندات التسوية المحذوفة</h2><button onclick="settlementsListPage()">رجوع</button></div>
        <div class="card"><table>${renderDeletedSettlementTable(rows)}</table></div>`;
}

// ======================== دوال الاستعلام والعرض ========================
function queryVouchers(type, deleted = false) {
    const sql = `
        SELECT v.id, v.voucher_number, v.date, v.ref, v.amount, v.amount_words, v.currency_id, v.description,
               v.account_id, a1.name as account_name,
               v.cash_account_id, a2.name as cash_account_name,
               v.debit_account_id, a3.name as debit_account_name,
               v.credit_account_id, a4.name as credit_account_name,
               v.advance_type
        FROM vouchers v
        LEFT JOIN chart_of_accounts a1 ON v.account_id = a1.id
        LEFT JOIN chart_of_accounts a2 ON v.cash_account_id = a2.id
        LEFT JOIN chart_of_accounts a3 ON v.debit_account_id = a3.id
        LEFT JOIN chart_of_accounts a4 ON v.credit_account_id = a4.id
        WHERE v.voucher_type = ? AND v.deleted = ?
        ORDER BY v.date DESC, v.id DESC`;
    const rows = query(sql, [type, deleted ? 1 : 0]);
    return rows.map(r => ({
        id: r[0], number: r[1], date: r[2], ref: r[3], amount: r[4], amountWords: r[5], currencyId: r[6], description: r[7],
        accountId: r[8], accountName: r[9], cashAccountId: r[10], cashAccountName: r[11],
        debitAccountId: r[12], debitAccountName: r[13], creditAccountId: r[14], creditAccountName: r[15],
        advanceType: r[16], voucher_type: type
    }));
}

function renderVoucherTable(rows) {
    let html = `<tr><th>الرقم</th><th>التاريخ</th><th>الحساب</th><th>الصندوق/البنك</th><th>المبلغ</th><th>إجراءات</th></tr>`;
    rows.forEach(r => {
html += `<tr><td>${r.number}</td><td>${r.date}</td><td>${r.accountName||''}</td><td>${r.cashAccountName||''}</td><td>${formatMoney(r.amount)}</td>
    <td><button onclick="viewVoucher('${r.voucher_type}', ${r.id})">عرض</button>
        ${canEditVoucher() ? `<button onclick="editVoucherForm(${r.id})">تعديل</button>` : ''}
        ${canDeleteVoucher() ? `<button onclick="deleteVoucher(${r.id})">حذف</button>` : ''}</td></tr>`;
    });
    return html;
}

function renderDeletedVoucherTable(rows) {
    let html = `<tr><th>الرقم</th><th>التاريخ</th><th>الحساب</th><th>الصندوق</th><th>المبلغ</th><th>إجراءات</th></tr>`;
    rows.forEach(r => {
        html += `<tr><td>${r.number}</td><td>${r.date}</td><td>${r.accountName||''}</td><td>${r.cashAccountName||''}</td><td>${formatMoney(r.amount)}</td>
            <td><button onclick="restoreVoucher(${r.id})">استرجاع</button>
                <button onclick="deleteVoucherPermanently(${r.id})">حذف نهائي</button></td></tr>`;
    });
    return html;
}

function renderAdvanceTable(rows) {
    let html = `<tr><th>الرقم</th><th>التاريخ</th><th>النوع</th><th>الحساب</th><th>الصندوق</th><th>المبلغ</th><th>إجراءات</th></tr>`;
    rows.forEach(r => {
        const typeName = r.advanceType === 'received' ? 'عربون مقبوض' : 'عربون مدفوع';
html += `<tr><td>${r.number}</td><td>${r.date}</td><td>${typeName}</td><td>${r.accountName||''}</td><td>${r.cashAccountName||''}</td><td>${formatMoney(r.amount)}</td>
    <td><button onclick="viewVoucher('Advance', ${r.id})">عرض</button>
        ${canEditVoucher() ? `<button onclick="editVoucherForm(${r.id})">تعديل</button>` : ''}
        ${canDeleteVoucher() ? `<button onclick="deleteVoucher(${r.id})">حذف</button>` : ''}</td></tr>`;
    });
    return html;
}

function renderDeletedAdvanceTable(rows) {
    let html = `<tr><th>الرقم</th><th>التاريخ</th><th>النوع</th><th>الحساب</th><th>الصندوق</th><th>المبلغ</th><th>إجراءات</th></tr>`;
    rows.forEach(r => {
        const typeName = r.advanceType === 'received' ? 'عربون مقبوض' : 'عربون مدفوع';
        html += `<tr><td>${r.number}</td><td>${r.date}</td><td>${typeName}</td><td>${r.accountName||''}</td><td>${r.cashAccountName||''}</td><td>${formatMoney(r.amount)}</td>
            <td><button onclick="restoreVoucher(${r.id})">استرجاع</button>
                <button onclick="deleteVoucherPermanently(${r.id})">حذف نهائي</button></td></tr>`;
    });
    return html;
}

function renderSettlementTable(rows) {
    let html = `<tr><th>الرقم</th><th>التاريخ</th><th>مدين</th><th>دائن</th><th>المبلغ</th><th>إجراءات</th></tr>`;
    rows.forEach(r => {
html += `<tr><td>${r.number}</td><td>${r.date}</td><td>${r.debitAccountName||''}</td><td>${r.creditAccountName||''}</td><td>${formatMoney(r.amount)}</td>
    <td><button onclick="viewVoucher('Settlement', ${r.id})">عرض</button>
        ${canEditVoucher() ? `<button onclick="editVoucherForm(${r.id})">تعديل</button>` : ''}
        ${canDeleteVoucher() ? `<button onclick="deleteVoucher(${r.id})">حذف</button>` : ''}</td></tr>`;
    });
    return html;
}

function renderDeletedSettlementTable(rows) {
    let html = `<tr><th>الرقم</th><th>التاريخ</th><th>مدين</th><th>دائن</th><th>المبلغ</th><th>إجراءات</th></tr>`;
    rows.forEach(r => {
        html += `<tr><td>${r.number}</td><td>${r.date}</td><td>${r.debitAccountName||''}</td><td>${r.creditAccountName||''}</td><td>${formatMoney(r.amount)}</td>
            <td><button onclick="restoreVoucher(${r.id})">استرجاع</button>
                <button onclick="deleteVoucherPermanently(${r.id})">حذف نهائي</button></td></tr>`;
    });
    return html;
}

// ======================== دوال الحذف والاستعادة ========================
function deleteVoucher(id) {
    const v = query(`SELECT * FROM vouchers WHERE id = ?`, [id])[0];
    if (!v) return;
    if (!confirm('حذف السند؟ سيتم عكس القيد المحاسبي.')) return;
    
    const type = v[12];
    const amount = v[6];
    const accountId = v[9];
    const cashAccountId = v[10];
    const debitAccountId = v[13];
    const creditAccountId = v[14];
    const advanceType = v[16];
    
    if (type === 'Receipt') {
        window.updateAccountBalance(cashAccountId, amount, 'credit');
        window.updateAccountBalance(accountId, amount, 'debit');
    } else if (type === 'Payment') {
        window.updateAccountBalance(accountId, amount, 'credit');
        window.updateAccountBalance(cashAccountId, amount, 'debit');
    } else if (type === 'Advance') {
        if (advanceType === 'received') {
            window.updateAccountBalance(cashAccountId, amount, 'credit');
            window.updateAccountBalance(accountId, amount, 'debit');
        } else {
            window.updateAccountBalance(accountId, amount, 'credit');
            window.updateAccountBalance(cashAccountId, amount, 'debit');
        }
    } else if (type === 'Settlement') {
        window.updateAccountBalance(debitAccountId, amount, 'credit');
        window.updateAccountBalance(creditAccountId, amount, 'debit');
    }
    
    deleteVoucherLogically(id);
    addLog('حذف سند', v[1]);
    alert('تم الحذف');
    
    if (type === 'Receipt') receiptsListPage();
    else if (type === 'Payment') paymentsListPage();
    else if (type === 'Advance') advanceListPage();
    else if (type === 'Settlement') settlementsListPage();
}

function restoreVoucher(id) {
    const v = query(`SELECT * FROM vouchers WHERE id = ?`, [id])[0];
    if (!v) return;
    
    const type = v[12];
    const amount = v[6];
    const accountId = v[9];
    const cashAccountId = v[10];
    const debitAccountId = v[13];
    const creditAccountId = v[14];
    const advanceType = v[16];
    
    if (type === 'Receipt') {
        window.updateAccountBalance(cashAccountId, amount, 'debit');
        window.updateAccountBalance(accountId, amount, 'credit');
    } else if (type === 'Payment') {
        window.updateAccountBalance(accountId, amount, 'debit');
        window.updateAccountBalance(cashAccountId, amount, 'credit');
    } else if (type === 'Advance') {
        if (advanceType === 'received') {
            window.updateAccountBalance(cashAccountId, amount, 'debit');
            window.updateAccountBalance(accountId, amount, 'credit');
        } else {
            window.updateAccountBalance(accountId, amount, 'debit');
            window.updateAccountBalance(cashAccountId, amount, 'credit');
        }
    } else if (type === 'Settlement') {
        window.updateAccountBalance(debitAccountId, amount, 'debit');
        window.updateAccountBalance(creditAccountId, amount, 'credit');
    }
    
    restoreVoucher(id);
    addLog('استرجاع سند', v[1]);
    alert('تم الاسترجاع');
    
    if (type === 'Receipt') deletedReceiptsPage();
    else if (type === 'Payment') deletedPaymentsPage();
    else if (type === 'Advance') deletedAdvancePage();
    else if (type === 'Settlement') deletedSettlementPage();
}

function deleteVoucherPermanently(id) {
    if (!confirm('حذف نهائي؟ لا يمكن التراجع.')) return;
    run(`DELETE FROM vouchers WHERE id = ?`, [id]);
    saveDatabase();
    alert('تم الحذف النهائي');
    
    const currentPage = content.innerHTML;
    if (currentPage.includes('سندات القبض المحذوفة')) deletedReceiptsPage();
    else if (currentPage.includes('سندات الصرف المحذوفة')) deletedPaymentsPage();
    else if (currentPage.includes('سندات العربون المحذوفة')) deletedAdvancePage();
    else if (currentPage.includes('سندات التسوية المحذوفة')) deletedSettlementPage();
}

// ======================== دوال عامة ========================
function getAccountOptions() {
    const accs = query(`SELECT id, code, name FROM chart_of_accounts WHERE is_active = 1 ORDER BY code`);
    return accs.map(a => `<option value="${a[0]}">${a[1]} - ${a[2]}</option>`).join('');
}

function getCashBankOptions() {
    const accs = query(`SELECT id, code, name FROM chart_of_accounts WHERE is_active = 1 AND (code LIKE '111%' OR code LIKE '112%') ORDER BY code`);
    return accs.map(a => `<option value="${a[0]}">${a[1]} - ${a[2]}</option>`).join('');
}

function updateAmountWords() {
    const amount = Number(document.getElementById('receiptAmount').value) || 0;
    document.getElementById('amountWords').value = numberToArabicWords(amount) + ' ريال';
}
function updatePaymentAmountWords() {
    const amount = Number(document.getElementById('paymentAmount').value) || 0;
    document.getElementById('paymentAmountWords').value = numberToArabicWords(amount) + ' ريال';
}
function updateAdvanceAmountWords() {
    const amount = Number(document.getElementById('advanceAmount').value) || 0;
    document.getElementById('advanceAmountWords').value = numberToArabicWords(amount) + ' ريال';
}
function updateSettlementAmountWords() {
    const amount = Number(document.getElementById('settlementAmount').value) || 0;
    document.getElementById('settlementAmountWords').value = numberToArabicWords(amount) + ' ريال';
}
// ================ دوال الصلاحيات ================
function canEditVoucher() {
    return window.hasPermission ? window.hasPermission('edit_vouchers') : true;
}
function canDeleteVoucher() {
    return window.hasPermission ? window.hasPermission('delete_vouchers') : true;
}
// ======================== دوال التعديل (موحدة لجميع السندات) ========================
// ======================== دوال التعديل (موحدة لجميع السندات - مصححة) ========================
function editVoucherForm(id) {
    const v = query(`SELECT * FROM vouchers WHERE id = ?`, [id])[0];
    if (!v) return;

    const voucher_number = v[1];
    const date = v[2];
    const type = v[3];
    const account_id = v[4];
    const cash_account_id = v[5];
    const debit_account_id = v[6];
    const credit_account_id = v[7];
    const amount = v[9];
    const currency_id = v[10];
    const description = v[12];
    const ref = v[13];
    const advance_type = v[14];

    const accountOptions = getAccountOptions();
    const cashOptions = getCashBankOptions();
    const currencyOptions = getCurrencyOptions(currency_id);

    let typeSpecificFields = '';

    if (type === 'Receipt') {
        typeSpecificFields = `
            <label>استلمنا من</label>
            <select id="editVoucherAccount">${accountOptions.replace(`value="${account_id}"`, `value="${account_id}" selected`)}</select>
            <label>إلى الصندوق / البنك</label>
            <select id="editVoucherCashAccount">${cashOptions.replace(`value="${cash_account_id}"`, `value="${cash_account_id}" selected`)}</select>
        `;
    } else if (type === 'Payment') {
        typeSpecificFields = `
            <label>صرفنا إلى</label>
            <select id="editVoucherAccount">${accountOptions.replace(`value="${account_id}"`, `value="${account_id}" selected`)}</select>
            <label>من الصندوق / البنك</label>
            <select id="editVoucherCashAccount">${cashOptions.replace(`value="${cash_account_id}"`, `value="${cash_account_id}" selected`)}</select>
        `;
    } else if (type === 'Advance') {
        typeSpecificFields = `
            <label>نوع العملية</label>
            <select id="editAdvanceType">
                <option value="received" ${advance_type === 'received' ? 'selected' : ''}>عربون مقبوض</option>
                <option value="paid" ${advance_type === 'paid' ? 'selected' : ''}>عربون مدفوع</option>
            </select>
            <label>الحساب</label>
            <select id="editVoucherAccount">${accountOptions.replace(`value="${account_id}"`, `value="${account_id}" selected`)}</select>
            <label>حساب الصندوق / البنك</label>
            <select id="editVoucherCashAccount">${cashOptions.replace(`value="${cash_account_id}"`, `value="${cash_account_id}" selected`)}</select>
        `;
    } else if (type === 'Settlement') {
        typeSpecificFields = `
            <label>الحساب المدين</label>
            <select id="editVoucherDebitAccount">${accountOptions.replace(`value="${debit_account_id}"`, `value="${debit_account_id}" selected`)}</select>
            <label>الحساب الدائن</label>
            <select id="editVoucherCreditAccount">${accountOptions.replace(`value="${credit_account_id}"`, `value="${credit_account_id}" selected`)}</select>
        `;
    }

    content.innerHTML = `
        <div class="card"><h2>تعديل سند ${voucher_number}</h2>
            <label>رقم السند</label><input value="${voucher_number}" readonly>
            <label>التاريخ</label><input id="editVoucherDate" type="date" value="${date}">
            <label>مرجع</label><input id="editVoucherRef" value="${ref || ''}">
            ${typeSpecificFields}
            <label>المبلغ</label><input id="editVoucherAmount" type="number" value="${amount}">
            <label>العملة</label><select id="editVoucherCurrency">${currencyOptions}</select>
            <label>البيان</label><input id="editVoucherDescription" value="${description || ''}">
            <br><br>
            <button onclick="updateVoucher(${id})">حفظ التعديلات</button>
            <button onclick="${type === 'Receipt' ? 'receiptsListPage()' : type === 'Payment' ? 'paymentsListPage()' : type === 'Advance' ? 'advanceListPage()' : 'settlementsListPage()'}">إلغاء</button>
        </div>
    `;
}

function updateVoucher(id) {
    const oldV = query(`SELECT * FROM vouchers WHERE id = ?`, [id])[0];
    if (!oldV) return;

    const type = oldV[3];
    const newAmount = Number(document.getElementById('editVoucherAmount').value) || 0;
    if (newAmount <= 0) { alert('المبلغ غير صحيح'); return; }

    let newAccountId = null, newCashAccountId = null, newDebitAccountId = null, newCreditAccountId = null, newAdvanceType = null;

    if (type === 'Receipt' || type === 'Payment' || type === 'Advance') {
        newAccountId = Number(document.getElementById('editVoucherAccount').value) || null;
        newCashAccountId = Number(document.getElementById('editVoucherCashAccount').value) || null;
    }
    if (type === 'Advance') {
        newAdvanceType = document.getElementById('editAdvanceType').value;
    }
    if (type === 'Settlement') {
        newDebitAccountId = Number(document.getElementById('editVoucherDebitAccount').value) || null;
        newCreditAccountId = Number(document.getElementById('editVoucherCreditAccount').value) || null;
    }

    // 1. عكس أثر السند القديم باستخدام القيم القديمة
    reverseVoucherEffect(oldV);

    // 2. تحديث بيانات السند في قاعدة البيانات
    run(`UPDATE vouchers SET 
        date = ?, ref = ?, amount = ?, currency_id = ?, description = ?, 
        account_id = ?, cash_account_id = ?, debit_account_id = ?, credit_account_id = ?, advance_type = ? 
        WHERE id = ?`, [
        document.getElementById('editVoucherDate').value,
        document.getElementById('editVoucherRef').value,
        newAmount,
        Number(document.getElementById('editVoucherCurrency').value),
        document.getElementById('editVoucherDescription').value,
        newAccountId, newCashAccountId, newDebitAccountId, newCreditAccountId, newAdvanceType,
        id
    ]);

    // 3. جلب بيانات السند الجديدة وتطبيقها
    const updatedV = query(`SELECT * FROM vouchers WHERE id = ?`, [id])[0];
    applyVoucherEffect(updatedV);

    saveDatabase();
    addLog('تعديل سند', oldV[1]);

    // 4. الانتقال للصفحة المناسبة مع تأخير بسيط لضمان ظهور التنبيه
    alert('✅ تم تعديل السند بنجاح');
    setTimeout(() => {
        if (type === 'Receipt') receiptsListPage();
        else if (type === 'Payment') paymentsListPage();
        else if (type === 'Advance') advanceListPage();
        else if (type === 'Settlement') settlementsListPage();
    }, 100);
}

// دوال مساعدة لعكس وتطبيق أثر السند
function reverseVoucherEffect(v) {
    const type = v[3], amount = v[9];
    const accountId = v[4], cashAccountId = v[5];
    const debitAccountId = v[6], creditAccountId = v[7];
    const advanceType = v[14];

    if (type === 'Receipt') {
        window.updateAccountBalance(cashAccountId, amount, 'credit');
        window.updateAccountBalance(accountId, amount, 'debit');
    } else if (type === 'Payment') {
        window.updateAccountBalance(accountId, amount, 'credit');
        window.updateAccountBalance(cashAccountId, amount, 'debit');
    } else if (type === 'Advance') {
        if (advanceType === 'received') {
            window.updateAccountBalance(cashAccountId, amount, 'credit');
            window.updateAccountBalance(accountId, amount, 'debit');
        } else {
            window.updateAccountBalance(accountId, amount, 'credit');
            window.updateAccountBalance(cashAccountId, amount, 'debit');
        }
    } else if (type === 'Settlement') {
        window.updateAccountBalance(debitAccountId, amount, 'credit');
        window.updateAccountBalance(creditAccountId, amount, 'debit');
    }
}

function applyVoucherEffect(v) {
    const type = v[3], amount = v[9];
    const accountId = v[4], cashAccountId = v[5];
    const debitAccountId = v[6], creditAccountId = v[7];
    const advanceType = v[14];

    if (type === 'Receipt') {
        window.updateAccountBalance(cashAccountId, amount, 'debit');
        window.updateAccountBalance(accountId, amount, 'credit');
    } else if (type === 'Payment') {
        window.updateAccountBalance(accountId, amount, 'debit');
        window.updateAccountBalance(cashAccountId, amount, 'credit');
    } else if (type === 'Advance') {
        if (advanceType === 'received') {
            window.updateAccountBalance(cashAccountId, amount, 'debit');
            window.updateAccountBalance(accountId, amount, 'credit');
        } else {
            window.updateAccountBalance(accountId, amount, 'debit');
            window.updateAccountBalance(cashAccountId, amount, 'credit');
        }
    } else if (type === 'Settlement') {
        window.updateAccountBalance(debitAccountId, amount, 'debit');
        window.updateAccountBalance(creditAccountId, amount, 'credit');
    }
}

function deleteVoucherAccountingOnly(v) {
    const type = v[12], amount = v[6];
    const accountId = v[9], cashAccountId = v[10];
    const debitAccountId = v[13], creditAccountId = v[14];
    const advanceType = v[16];

    if (type === 'Receipt') {
        window.updateAccountBalance(cashAccountId, amount, 'credit');
        window.updateAccountBalance(accountId, amount, 'debit');
    } else if (type === 'Payment') {
        window.updateAccountBalance(accountId, amount, 'credit');
        window.updateAccountBalance(cashAccountId, amount, 'debit');
    } else if (type === 'Advance') {
        if (advanceType === 'received') {
            window.updateAccountBalance(cashAccountId, amount, 'credit');
            window.updateAccountBalance(accountId, amount, 'debit');
        } else {
            window.updateAccountBalance(accountId, amount, 'credit');
            window.updateAccountBalance(cashAccountId, amount, 'debit');
        }
    } else if (type === 'Settlement') {
        window.updateAccountBalance(debitAccountId, amount, 'credit');
        window.updateAccountBalance(creditAccountId, amount, 'debit');
    }
}

function applyVoucherAccounting(v) {
    const type = v[12], amount = v[6];
    const accountId = v[9], cashAccountId = v[10];
    const debitAccountId = v[13], creditAccountId = v[14];
    const advanceType = v[16];

    if (type === 'Receipt') {
        window.updateAccountBalance(cashAccountId, amount, 'debit');
        window.updateAccountBalance(accountId, amount, 'credit');
    } else if (type === 'Payment') {
        window.updateAccountBalance(accountId, amount, 'debit');
        window.updateAccountBalance(cashAccountId, amount, 'credit');
    } else if (type === 'Advance') {
        if (advanceType === 'received') {
            window.updateAccountBalance(cashAccountId, amount, 'debit');
            window.updateAccountBalance(accountId, amount, 'credit');
        } else {
            window.updateAccountBalance(accountId, amount, 'debit');
            window.updateAccountBalance(cashAccountId, amount, 'credit');
        }
    } else if (type === 'Settlement') {
        window.updateAccountBalance(debitAccountId, amount, 'debit');
        window.updateAccountBalance(creditAccountId, amount, 'credit');
    }
}

// تعريض الدوال
window.initVouchers = initVouchers;
window.vouchersPage = vouchersPage;
window.receiptsMenuPage = receiptsMenuPage;
window.paymentsMenuPage = paymentsMenuPage;
window.advanceMenuPage = advanceMenuPage;
window.settlementMenuPage = settlementMenuPage;
window.addReceiptForm = addReceiptForm;
window.saveReceipt = saveReceipt;
window.receiptsListPage = receiptsListPage;
window.deletedReceiptsPage = deletedReceiptsPage;
window.addPaymentForm = addPaymentForm;
window.savePayment = savePayment;
window.paymentsListPage = paymentsListPage;
window.deletedPaymentsPage = deletedPaymentsPage;
window.addAdvanceForm = addAdvanceForm;
window.saveAdvance = saveAdvance;
window.advanceListPage = advanceListPage;
window.deletedAdvancePage = deletedAdvancePage;
window.addSettlementForm = addSettlementForm;
window.saveSettlement = saveSettlement;
window.settlementsListPage = settlementsListPage;
window.deletedSettlementPage = deletedSettlementPage;
window.searchReceipts = searchReceipts;
window.searchPayments = searchPayments;
window.searchAdvances = searchAdvances;
window.searchSettlements = searchSettlements;
window.viewVoucher = viewVoucher;
window.deleteVoucher = deleteVoucher;
window.restoreVoucher = restoreVoucher;
window.deleteVoucherPermanently = deleteVoucherPermanently;
window.updateAmountWords = updateAmountWords;
window.updatePaymentAmountWords = updatePaymentAmountWords;
window.updateAdvanceAmountWords = updateAdvanceAmountWords;
window.updateSettlementAmountWords = updateSettlementAmountWords;
window.editVoucherForm = editVoucherForm;
window.updateVoucher = updateVoucher;
