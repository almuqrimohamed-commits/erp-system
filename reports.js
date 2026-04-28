// reports.js - وحدة التقارير الشاملة (مصححة ومتكاملة - طباعة وتصدير مضبوطان)
console.log('📊 تحميل وحدة التقارير...');

// ======================== الصفحة الرئيسية للتقارير ========================
function reportsPage() {
    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-chart-bar"></i> التقارير</h2>
        </div>
        <div class="card">
            <h3>📦 تقارير المخزون</h3>
            <button onclick="stockValuationReport()">تقييم المخزون</button>
            <button onclick="stockMovementReport()">حركة صنف</button>
            <button onclick="lowStockReport()">أصناف أقل من الحد الأدنى</button>
        </div>
        <div class="card">
            <h3>🛒 تقارير المبيعات</h3>
            <button onclick="salesByDateReport()">مبيعات حسب الفترة</button>
            <button onclick="salesByCustomerReport()">مبيعات حسب العميل</button>
            <button onclick="salesByItemReport()">مبيعات حسب الصنف</button>
        </div>
        <div class="card">
            <h3>📦 تقارير المشتريات</h3>
            <button onclick="purchasesByDateReport()">مشتريات حسب الفترة</button>
            <button onclick="purchasesBySupplierReport()">مشتريات حسب المورد</button>
            <button onclick="purchasesByItemReport()">مشتريات حسب الصنف</button>
        </div>
        <div class="card">
            <h3>📒 التقارير المحاسبية</h3>
            <button onclick="accountStatementReport()">كشف حساب</button>
            <button onclick="dailyJournalReport()">الحركة اليومية</button>
            <button onclick="generalLedgerReport()">دفتر الأستاذ</button>
            <button onclick="trialBalanceReport()">ميزان المراجعة</button>
            <button onclick="trialBalanceWithMovementHierarchical()">ميزان المراجعة بالحركة (هرمي)</button>
        </div>
        <div class="card">
            <h3>📑 تقارير الختام</h3>
            <button onclick="incomeStatementReport()">قائمة الدخل</button>
            <button onclick="balanceSheetReport()">الميزانية العمومية</button>
        </div>
        <div class="card">
            <button onclick="dashboard()">↩️ رجوع</button>
        </div>
    `;
}

// ======================== دوال مساعدة عامة ========================
function renderDateFilter(callback) {
    content.innerHTML = `
        <div class="card">
            <h3>تحديد الفترة</h3>
            <label>من تاريخ</label>
            <input id="fromDate" type="date" value="${today()}">
            <label>إلى تاريخ</label>
            <input id="toDate" type="date" value="${today()}">
            <br><br>
            <button onclick="${callback}">عرض التقرير</button>
            <button onclick="reportsPage()">رجوع</button>
        </div>
        <div id="reportResult" class="card"></div>
    `;
}

function renderAccountFilter(title, callback, showParty = false) {
    let accountOptions = '<option value="">اختر الحساب</option>';
    const accounts = query(`SELECT id, code, name FROM chart_of_accounts WHERE is_active = 1 ORDER BY code`);
    accounts.forEach(a => accountOptions += `<option value="${a[0]}">${a[1]} - ${a[2]}</option>`);

    let partyOptions = '';
    if (showParty) {
        partyOptions = '<option value="">أو اختر عميل/مورد</option>';
        const parties = query(`SELECT id, name, type FROM partners WHERE deleted = 0 ORDER BY name`);
        parties.forEach(p => partyOptions += `<option value="${p[0]}" data-type="${p[2]}">${p[1]} (${p[2] === 'Customer' ? 'عميل' : 'مورد'})</option>`);
    }

    content.innerHTML = `
        <div class="card">
            <h3>${title}</h3>
            <label>من تاريخ</label>
            <input id="fromDate" type="date" value="${today()}">
            <label>إلى تاريخ</label>
            <input id="toDate" type="date" value="${today()}">
            <label>الحساب</label>
            <select id="accountId">${accountOptions}</select>
            ${showParty ? `<label>أو</label><select id="partyId">${partyOptions}</select>` : ''}
            <br><br>
            <button onclick="${callback}">عرض التقرير</button>
            <button onclick="reportsPage()">رجوع</button>
        </div>
        <div id="reportResult" class="card"></div>
    `;
}

function getAccountIdFromFilter() {
    const accountId = document.getElementById('accountId')?.value;
    const partyId = document.getElementById('partyId')?.value;
    if (partyId) {
        const partyRow = query(`SELECT account_id FROM partners WHERE id = ?`, [partyId])[0];
        return partyRow ? partyRow[0] : null;
    }
    return accountId || null;
}

// حركة الحساب شاملة السندات (مدين/دائن خلال فترة)
function getMovementForAccountWithVouchers(accountId, fromDate, toDate) {
    let d = 0, c = 0;
    const jm = query(`SELECT COALESCE(SUM(l.debit),0), COALESCE(SUM(l.credit),0) FROM journal_entry_lines l JOIN journal_entries e ON l.entry_id=e.id WHERE l.account_id=? AND e.status='Posted' AND e.date BETWEEN ? AND ?`, [accountId, fromDate, toDate]);
    if (jm.length) { d += jm[0][0]||0; c += jm[0][1]||0; }

    const vm = query(`SELECT 
        COALESCE(SUM(CASE WHEN (v.voucher_type='Receipt' AND v.cash_account_id=?) OR (v.voucher_type='Payment' AND v.account_id=?) OR (v.voucher_type='Advance' AND v.advance_type='paid' AND v.account_id=?) OR (v.voucher_type='Advance' AND v.advance_type='received' AND v.cash_account_id=?) OR (v.voucher_type='Settlement' AND v.debit_account_id=?) THEN v.amount ELSE 0 END),0),
        COALESCE(SUM(CASE WHEN (v.voucher_type='Receipt' AND v.account_id=?) OR (v.voucher_type='Payment' AND v.cash_account_id=?) OR (v.voucher_type='Advance' AND v.advance_type='received' AND v.account_id=?) OR (v.voucher_type='Advance' AND v.advance_type='paid' AND v.cash_account_id=?) OR (v.voucher_type='Settlement' AND v.credit_account_id=?) THEN v.amount ELSE 0 END),0)
        FROM vouchers v WHERE v.status='Posted' AND v.deleted=0 AND v.date BETWEEN ? AND ? AND (v.account_id=? OR v.cash_account_id=? OR v.debit_account_id=? OR v.credit_account_id=?)`, 
        [accountId, accountId, accountId, accountId, accountId, accountId, accountId, accountId, accountId, accountId, fromDate, toDate, accountId, accountId, accountId, accountId]);
    if (vm.length) { d += vm[0][0]||0; c += vm[0][1]||0; }
    return { debit: d, credit: c };
}

// الرصيد الافتتاحي للحساب
function getOpeningBalanceForAccount(accountId, fromDate) {

    if (!accountId || !fromDate)
        return 0;

    try {

        let balance = 0;

        // 1) القيود اليومية قبل الفترة

        const journal = query(`
            SELECT
                COALESCE(SUM(l.debit),0) -
                COALESCE(SUM(l.credit),0)
            FROM journal_entry_lines l
            JOIN journal_entries e
            ON l.entry_id = e.id
            WHERE l.account_id = ?
            AND e.status = 'Posted'
            AND e.date < ?
        `, [accountId, fromDate]);

        balance += journal[0][0] || 0;

        // 2) السندات قبل الفترة

        const vouchers = query(`
            SELECT
                COALESCE(SUM(
                    CASE
                        WHEN v.voucher_type='Receipt'
                             AND v.cash_account_id=?
                        THEN v.amount

                        WHEN v.voucher_type='Payment'
                             AND v.account_id=?
                        THEN v.amount

                        WHEN v.voucher_type='Advance'
                             AND v.advance_type='paid'
                             AND v.account_id=?
                        THEN v.amount

                        WHEN v.voucher_type='Advance'
                             AND v.advance_type='received'
                             AND v.cash_account_id=?
                        THEN v.amount

                        WHEN v.voucher_type='Settlement'
                             AND v.debit_account_id=?
                        THEN v.amount

                        ELSE 0
                    END
                ),0)

                -

                COALESCE(SUM(
                    CASE
                        WHEN v.voucher_type='Receipt'
                             AND v.account_id=?
                        THEN v.amount

                        WHEN v.voucher_type='Payment'
                             AND v.cash_account_id=?
                        THEN v.amount

                        WHEN v.voucher_type='Advance'
                             AND v.advance_type='received'
                             AND v.account_id=?
                        THEN v.amount

                        WHEN v.voucher_type='Advance'
                             AND v.advance_type='paid'
                             AND v.cash_account_id=?
                        THEN v.amount

                        WHEN v.voucher_type='Settlement'
                             AND v.credit_account_id=?
                        THEN v.amount

                        ELSE 0
                    END
                ),0)

            FROM vouchers v
            WHERE v.status='Posted'
            AND v.deleted=0
            AND v.date < ?
        `, [
            accountId,
            accountId,
            accountId,
            accountId,
            accountId,

            accountId,
            accountId,
            accountId,
            accountId,
            accountId,

            fromDate
        ]);

        balance += vouchers[0][0] || 0;

        return balance;

    }
    catch (e) {

        console.error(
            "Opening balance calculation failed",
            e
        );

        return 0;

    }

}

// صافي الدخل الموحد (الإيرادات - المصروفات) لفترة
function getNetIncome(fromDate, toDate) {
    const revAccounts = query(`SELECT id FROM chart_of_accounts WHERE type='Revenue' AND is_active=1`);
    const expAccounts = query(`SELECT id FROM chart_of_accounts WHERE type='Expense' AND is_active=1`);
    let totalRev = 0, totalExp = 0;
    revAccounts.forEach(acc => {
        const move = getMovementForAccountWithVouchers(acc[0], fromDate, toDate);
        totalRev += (move.credit - move.debit);
    });
    expAccounts.forEach(acc => {
        const move = getMovementForAccountWithVouchers(acc[0], fromDate, toDate);
        totalExp += (move.debit - move.credit);
    });
    return totalRev - totalExp;
}

// ======================== تقارير المخزون ========================
function stockValuationReport() {
    const items = query(`
        SELECT i.name, c.name, i.current_stock, i.purchase_cost, (i.current_stock * i.purchase_cost) as value
        FROM items i
        LEFT JOIN item_categories c ON i.category_id = c.id
        WHERE i.is_active = 1
        ORDER BY i.name
    `);
    let rows = '', totalValue = 0;
    items.forEach(it => { totalValue += it[4] || 0; rows += `<tr><td>${it[0]}</td><td>${it[1]||'-'}</td><td>${it[2]}</td><td>${formatMoney(it[3])}</td><td>${formatMoney(it[4])}</td></tr>`; });
    const reportHtml = `<h3>تقييم المخزون</h3><table><tr><th>الصنف</th><th>الفئة</th><th>الكمية</th><th>تكلفة الوحدة</th><th>القيمة</th></tr>${rows}<tr style="font-weight:bold"><td colspan="4">الإجمالي</td><td>${formatMoney(totalValue)}</td></tr></table>`;
    content.innerHTML = `<div class="card"><h3>تقييم المخزون</h3><button onclick="printContent(document.getElementById('reportContent').innerHTML, 'تقييم المخزون')">طباعة</button> <button onclick="reportsPage()">رجوع</button></div><div class="card" id="reportContent">${reportHtml}</div>`;
}

function stockMovementReport() {
    const items = query(`SELECT id, name FROM items WHERE is_active = 1 ORDER BY name`);
    let options = '<option value="">اختر الصنف</option>';
    items.forEach(i => options += `<option value="${i[0]}">${i[1]}</option>`);
    content.innerHTML = `<div class="card"><h3>حركة صنف</h3><label>الصنف</label><select id="itemId">${options}</select><label>من تاريخ</label><input id="fromDate" type="date" value="${today()}"><label>إلى تاريخ</label><input id="toDate" type="date" value="${today()}"><button onclick="showStockMovement()">عرض</button><button onclick="reportsPage()">رجوع</button></div><div id="reportResult" class="card"></div>`;
}
function showStockMovement() {
    const itemId = document.getElementById('itemId').value;
    const from = document.getElementById('fromDate').value, to = document.getElementById('toDate').value;
    if (!itemId) { alert('اختر الصنف'); return; }
    const moves = query(`
        SELECT date, 'شراء' as type, invoice_number, quantity FROM purchase_invoices pi JOIN purchase_invoice_lines pil ON pi.id=pil.invoice_id WHERE pi.status='Posted' AND pil.item_id=? AND date BETWEEN ? AND ?
        UNION ALL SELECT date, 'مرتجع شراء', return_number, -quantity FROM purchase_returns pr JOIN purchase_return_lines prl ON pr.id=prl.return_id WHERE pr.status='Posted' AND prl.item_id=? AND date BETWEEN ? AND ?
        UNION ALL SELECT date, 'بيع', invoice_number, -quantity FROM sales_invoices si JOIN sales_invoice_lines sil ON si.id=sil.invoice_id WHERE si.status='Posted' AND sil.item_id=? AND date BETWEEN ? AND ?
        UNION ALL SELECT date, 'مرتجع بيع', return_number, quantity FROM sales_returns sr JOIN sales_return_lines srl ON sr.id=srl.return_id WHERE sr.status='Posted' AND srl.item_id=? AND date BETWEEN ? AND ?
        ORDER BY date
    `, [itemId, from, to, itemId, from, to, itemId, from, to, itemId, from, to]);
    let rows = '', balance = 0;
    moves.forEach(m => { balance += m[3]; rows += `<tr><td>${m[0]}</td><td>${m[1]}</td><td>${m[2]}</td><td>${m[3]}</td><td>${balance}</td></tr>`; });
    const itemName = query(`SELECT name FROM items WHERE id=?`, [itemId])[0][0];
    const reportHtml = `<h3>حركة الصنف: ${itemName}</h3><table><tr><th>التاريخ</th><th>النوع</th><th>المرجع</th><th>الكمية</th><th>الرصيد</th></tr>${rows || '<tr><td colspan="5">لا توجد حركة</td></tr>'}</table>`;
    document.getElementById('reportResult').innerHTML = `<button onclick="printContent(document.getElementById('reportContent').innerHTML, 'حركة ${itemName}')">طباعة</button><div id="reportContent">${reportHtml}</div>`;
}

function lowStockReport() {
    const items = query(`SELECT name, current_stock, reorder_level FROM items WHERE is_active=1 AND reorder_level>0 AND current_stock < reorder_level`);
    let rows = ''; items.forEach(i => rows += `<tr><td>${i[0]}</td><td>${i[1]}</td><td>${i[2]}</td></tr>`);
    const reportHtml = `<h3>أصناف أقل من الحد الأدنى</h3><table><tr><th>الصنف</th><th>الكمية</th><th>حد الطلب</th></tr>${rows||'<tr><td colspan="3">لا توجد أصناف</td></tr>'}</table>`;
    content.innerHTML = `<div class="card"><h3>أصناف أقل من الحد الأدنى</h3><button onclick="printContent(document.getElementById('reportContent').innerHTML, 'تنبيهات المخزون')">طباعة</button> <button onclick="reportsPage()">رجوع</button></div><div class="card" id="reportContent">${reportHtml}</div>`;
}

// ======================== تقارير المبيعات ========================
function salesByDateReport() { renderDateFilter('showSalesByDate()'); }
function showSalesByDate() {
    const from = document.getElementById('fromDate').value, to = document.getElementById('toDate').value;
    const invoices = query(`SELECT invoice_number, date, p.name, total FROM sales_invoices s LEFT JOIN partners p ON s.customer_id=p.id WHERE s.status='Posted' AND date BETWEEN ? AND ? ORDER BY date`, [from, to]);
    let rows = '', total = 0;
    invoices.forEach(i => { total += i[3]; rows += `<tr><td>${i[0]}</td><td>${i[1]}</td><td>${i[2]||'نقدي'}</td><td>${formatMoney(i[3])}</td></tr>`; });
    const reportHtml = `<h3>مبيعات من ${from} إلى ${to}</h3><table><tr><th>الرقم</th><th>التاريخ</th><th>العميل</th><th>الإجمالي</th></tr>${rows}<tr><th colspan="3">الإجمالي</th><th>${formatMoney(total)}</th></tr></table>`;
    document.getElementById('reportResult').innerHTML = `<button onclick="printContent(document.getElementById('reportContent').innerHTML, 'تقرير المبيعات')">طباعة</button><div id="reportContent">${reportHtml}</div>`;
}
function salesByCustomerReport() { renderDateFilter('showSalesByCustomer()'); }
function showSalesByCustomer() {
    const from = document.getElementById('fromDate').value, to = document.getElementById('toDate').value;
    const data = query(`SELECT p.name, SUM(s.total) FROM sales_invoices s LEFT JOIN partners p ON s.customer_id=p.id WHERE s.status='Posted' AND date BETWEEN ? AND ? GROUP BY p.id ORDER BY p.name`, [from, to]);
    let rows = '', total = 0;
    data.forEach(d => { total += d[1]; rows += `<tr><td>${d[0]||'نقدي'}</td><td>${formatMoney(d[1])}</td></tr>`; });
    const reportHtml = `<h3>مبيعات حسب العميل</h3><table><tr><th>العميل</th><th>الإجمالي</th></tr>${rows}<tr><th>الإجمالي</th><th>${formatMoney(total)}</th></tr></table>`;
    document.getElementById('reportResult').innerHTML = `<button onclick="printContent(document.getElementById('reportContent').innerHTML, 'مبيعات حسب العميل')">طباعة</button><div id="reportContent">${reportHtml}</div>`;
}
function salesByItemReport() { renderDateFilter('showSalesByItem()'); }
function showSalesByItem() {
    const from = document.getElementById('fromDate').value, to = document.getElementById('toDate').value;
    const data = query(`SELECT i.name, SUM(sil.quantity), SUM(sil.line_total) FROM sales_invoice_lines sil JOIN sales_invoices s ON sil.invoice_id=s.id JOIN items i ON sil.item_id=i.id WHERE s.status='Posted' AND s.date BETWEEN ? AND ? GROUP BY i.id ORDER BY i.name`, [from, to]);
    let rows = '', totalQty = 0, totalVal = 0;
    data.forEach(d => { totalQty += d[1]; totalVal += d[2]; rows += `<tr><td>${d[0]}</td><td>${d[1]}</td><td>${formatMoney(d[2])}</td></tr>`; });
    const reportHtml = `<h3>مبيعات حسب الصنف</h3><table><tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th></tr>${rows}<tr><th>الإجمالي</th><th>${totalQty}</th><th>${formatMoney(totalVal)}</th></tr></table>`;
    document.getElementById('reportResult').innerHTML = `<button onclick="printContent(document.getElementById('reportContent').innerHTML, 'مبيعات حسب الصنف')">طباعة</button><div id="reportContent">${reportHtml}</div>`;
}

// ======================== تقارير المشتريات ========================
function purchasesByDateReport() { renderDateFilter('showPurchasesByDate()'); }
function showPurchasesByDate() {
    const from = document.getElementById('fromDate').value, to = document.getElementById('toDate').value;
    const invoices = query(`SELECT invoice_number, date, p.name, total FROM purchase_invoices pu LEFT JOIN partners p ON pu.supplier_id=p.id WHERE pu.status='Posted' AND date BETWEEN ? AND ? ORDER BY date`, [from, to]);
    let rows = '', total = 0;
    invoices.forEach(i => { total += i[3]; rows += `<tr><td>${i[0]}</td><td>${i[1]}</td><td>${i[2]||'-'}</td><td>${formatMoney(i[3])}</td></tr>`; });
    const reportHtml = `<h3>مشتريات من ${from} إلى ${to}</h3><table><tr><th>الرقم</th><th>التاريخ</th><th>المورد</th><th>الإجمالي</th></tr>${rows}<tr><th colspan="3">الإجمالي</th><th>${formatMoney(total)}</th></tr></table>`;
    document.getElementById('reportResult').innerHTML = `<button onclick="printContent(document.getElementById('reportContent').innerHTML, 'تقرير المشتريات')">طباعة</button><div id="reportContent">${reportHtml}</div>`;
}
function purchasesBySupplierReport() { renderDateFilter('showPurchasesBySupplier()'); }
function showPurchasesBySupplier() {
    const from = document.getElementById('fromDate').value, to = document.getElementById('toDate').value;
    const data = query(`SELECT p.name, SUM(pu.total) FROM purchase_invoices pu LEFT JOIN partners p ON pu.supplier_id=p.id WHERE pu.status='Posted' AND date BETWEEN ? AND ? GROUP BY p.id ORDER BY p.name`, [from, to]);
    let rows = '', total = 0;
    data.forEach(d => { total += d[1]; rows += `<tr><td>${d[0]||'-'}</td><td>${formatMoney(d[1])}</td></tr>`; });
    const reportHtml = `<h3>مشتريات حسب المورد</h3><table><tr><th>المورد</th><th>الإجمالي</th></tr>${rows}<tr><th>الإجمالي</th><th>${formatMoney(total)}</th></tr></table>`;
    document.getElementById('reportResult').innerHTML = `<button onclick="printContent(document.getElementById('reportContent').innerHTML, 'مشتريات حسب المورد')">طباعة</button><div id="reportContent">${reportHtml}</div>`;
}
function purchasesByItemReport() { renderDateFilter('showPurchasesByItem()'); }
function showPurchasesByItem() {
    const from = document.getElementById('fromDate').value, to = document.getElementById('toDate').value;
    const data = query(`SELECT i.name, SUM(pil.quantity), SUM(pil.line_total) FROM purchase_invoice_lines pil JOIN purchase_invoices p ON pil.invoice_id=p.id JOIN items i ON pil.item_id=i.id WHERE p.status='Posted' AND p.date BETWEEN ? AND ? GROUP BY i.id ORDER BY i.name`, [from, to]);
    let rows = '', totalQty = 0, totalVal = 0;
    data.forEach(d => { totalQty += d[1]; totalVal += d[2]; rows += `<tr><td>${d[0]}</td><td>${d[1]}</td><td>${formatMoney(d[2])}</td></tr>`; });
    const reportHtml = `<h3>مشتريات حسب الصنف</h3><table><tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th></tr>${rows}<tr><th>الإجمالي</th><th>${totalQty}</th><th>${formatMoney(totalVal)}</th></tr></table>`;
    document.getElementById('reportResult').innerHTML = `<button onclick="printContent(document.getElementById('reportContent').innerHTML, 'مشتريات حسب الصنف')">طباعة</button><div id="reportContent">${reportHtml}</div>`;
}

// ======================== التقارير المحاسبية ========================
function accountStatementReport() { renderAccountFilter('كشف حساب', 'showAccountStatement()', true); }
function showAccountStatement() {
    const accountId = getAccountIdFromFilter();
    if (!accountId) { alert('اختر حساباً أو عميل/مورد'); return; }
    const from = document.getElementById('fromDate').value, to = document.getElementById('toDate').value;
    const account = query(`SELECT code, name FROM chart_of_accounts WHERE id=?`, [accountId])[0];
    if (!account) { alert('الحساب غير موجود'); return; }
    
    const opening = getOpeningBalanceForAccount(accountId, from);
    let rows = `<tr><td>${from}</td><td>رصيد افتتاحي</td><td>-</td><td>${opening > 0 ? formatMoney(opening) : '0.00'}</td><td>${opening < 0 ? formatMoney(-opening) : '0.00'}</td><td>${formatMoney(opening)}</td><td></td></tr>`;
    let balance = opening;

    const unified = query(`
        SELECT date, description, ref, debit, credit, source FROM (
            SELECT e.date, e.description, e.entry_number AS ref, l.debit, l.credit, 'journal' AS source
            FROM journal_entry_lines l JOIN journal_entries e ON l.entry_id = e.id
            WHERE l.account_id = ? AND e.status = 'Posted' AND e.date BETWEEN ? AND ?
            UNION ALL
            SELECT v.date, v.description, v.voucher_number AS ref,
                CASE WHEN v.voucher_type='Receipt' AND v.cash_account_id=? THEN v.amount
                     WHEN v.voucher_type='Payment' AND v.account_id=? THEN v.amount
                     WHEN v.voucher_type='Advance' AND v.advance_type='paid' AND v.account_id=? THEN v.amount
                     WHEN v.voucher_type='Advance' AND v.advance_type='received' AND v.cash_account_id=? THEN v.amount
                     WHEN v.voucher_type='Settlement' AND v.debit_account_id=? THEN v.amount ELSE 0 END AS debit,
                CASE WHEN v.voucher_type='Receipt' AND v.account_id=? THEN v.amount
                     WHEN v.voucher_type='Payment' AND v.cash_account_id=? THEN v.amount
                     WHEN v.voucher_type='Advance' AND v.advance_type='received' AND v.account_id=? THEN v.amount
                     WHEN v.voucher_type='Advance' AND v.advance_type='paid' AND v.cash_account_id=? THEN v.amount
                     WHEN v.voucher_type='Settlement' AND v.credit_account_id=? THEN v.amount ELSE 0 END AS credit,
                CASE WHEN v.voucher_type='Receipt' THEN 'receipt' WHEN v.voucher_type='Payment' THEN 'payment' WHEN v.voucher_type='Advance' THEN 'advance' WHEN v.voucher_type='Settlement' THEN 'settlement' ELSE 'voucher' END AS source
            FROM vouchers v
            WHERE v.status='Posted' AND v.deleted=0 AND v.date BETWEEN ? AND ? AND (v.account_id=? OR v.cash_account_id=? OR v.debit_account_id=? OR v.credit_account_id=?)
        ) ORDER BY date, ref
    `, [accountId, from, to, accountId, accountId, accountId, accountId, accountId, accountId, accountId, accountId, accountId, accountId, from, to, accountId, accountId, accountId, accountId]);

    unified.forEach(row => {
        const date = row[0], desc = row[1] || '', ref = row[2] || '-', debit = row[3] || 0, credit = row[4] || 0, source = row[5];
        let typeLabel = source === 'journal' ? 'قيود يومية' : source === 'receipt' ? 'سند قبض' : source === 'payment' ? 'سند صرف' : source === 'advance' ? 'سند عربون' : source === 'settlement' ? 'سند تسوية' : 'سند';
        balance += debit - credit;
        rows += `<tr><td>${date}</td><td>${desc}</td><td>${ref} (${typeLabel})</td><td>${debit ? formatMoney(debit) : '0.00'}</td><td>${credit ? formatMoney(credit) : '0.00'}</td><td>${formatMoney(balance)}</td><td>${typeLabel}</td></tr>`;
    });

    const reportHtml = `<h3>كشف حساب ${account[0]} - ${account[1]}</h3><table><tr><th>التاريخ</th><th>البيان</th><th>المستند</th><th>مدين</th><th>دائن</th><th>الرصيد</th><th>النوع</th></tr>${rows}</table>`;
    document.getElementById('reportResult').innerHTML = `<button onclick="printContent(document.getElementById('reportContent').innerHTML, 'كشف حساب')">طباعة</button><div id="reportContent">${reportHtml}</div>`;
}

function dailyJournalReport() { renderDateFilter('showDailyJournal()'); }
function showDailyJournal() {
    const from = document.getElementById('fromDate').value, to = document.getElementById('toDate').value;
    const entries = query(`SELECT entry_number, date, description, (SELECT SUM(debit) FROM journal_entry_lines WHERE entry_id=e.id) as debit, (SELECT SUM(credit) FROM journal_entry_lines WHERE entry_id=e.id) as credit FROM journal_entries e WHERE status='Posted' AND date BETWEEN ? AND ? ORDER BY date, id`, [from, to]);
    let rows = '';
    entries.forEach(e => rows += `<tr><td>${e[0]}</td><td>${e[1]}</td><td>${e[2]}</td><td>${formatMoney(e[3])}</td><td>${formatMoney(e[4])}</td></tr>`);
    const reportHtml = `<h3>الحركة اليومية</h3><table><tr><th>الرقم</th><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th></tr>${rows||'<tr><td colspan="5">لا توجد قيود</td></tr>'}</table>`;
    document.getElementById('reportResult').innerHTML = `<button onclick="printContent(document.getElementById('reportContent').innerHTML, 'دفتر اليومية')">طباعة</button><div id="reportContent">${reportHtml}</div>`;
}

function generalLedgerReport() { renderAccountFilter('دفتر الأستاذ', 'showGeneralLedger()'); }
function showGeneralLedger() {
    const accountId = document.getElementById('accountId').value;
    if (!accountId) { alert('اختر حساباً'); return; }
    const from = document.getElementById('fromDate').value, to = document.getElementById('toDate').value;
    const account = query(`SELECT code, name FROM chart_of_accounts WHERE id=?`, [accountId])[0];
    const opening = getOpeningBalanceForAccount(accountId, from);
    let rows = `<tr><td>${from}</td><td>رصيد افتتاحي</td><td>-</td><td>${opening > 0 ? formatMoney(opening) : '0.00'}</td><td>${opening < 0 ? formatMoney(-opening) : '0.00'}</td><td>${formatMoney(opening)}</td></tr>`;
    let balance = opening;
    const lines = query(`SELECT e.date, e.description, e.entry_number, l.debit, l.credit FROM journal_entry_lines l JOIN journal_entries e ON l.entry_id=e.id WHERE l.account_id=? AND e.status='Posted' AND e.date BETWEEN ? AND ? ORDER BY e.date`, [accountId, from, to]);
    lines.forEach(l => { balance += l[3] - l[4]; rows += `<tr><td>${l[0]}</td><td>${l[1]}</td><td>${l[2]}</td><td>${formatMoney(l[3])}</td><td>${formatMoney(l[4])}</td><td>${formatMoney(balance)}</td></tr>`; });
    const reportHtml = `<h3>دفتر أستاذ ${account[0]} - ${account[1]}</h3><table><tr><th>التاريخ</th><th>البيان</th><th>الرقم</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr>${rows}</table>`;
    document.getElementById('reportResult').innerHTML = `<button onclick="printContent(document.getElementById('reportContent').innerHTML, 'دفتر الأستاذ')">طباعة</button><div id="reportContent">${reportHtml}</div>`;
}

// ميزان المراجعة
function trialBalanceReport() {
    const accounts = query(`SELECT id, code, name, type FROM chart_of_accounts WHERE is_active=1 ORDER BY code`);
    let rows = '', totalDebit = 0, totalCredit = 0;
    accounts.forEach(a => {
        const id = a[0], code = a[1], name = a[2], type = a[3];
        const bal = window.getAccountBalance ? window.getAccountBalance(id) : 0;
        let debitAmount = 0, creditAmount = 0;
        if (type === 'Asset' || type === 'Expense') {
            if (bal > 0) debitAmount = bal; else if (bal < 0) creditAmount = -bal;
        } else {
            if (bal > 0) creditAmount = bal; else if (bal < 0) debitAmount = -bal;
        }
        if (debitAmount !== 0 || creditAmount !== 0) {
            totalDebit += debitAmount; totalCredit += creditAmount;
            rows += `<tr><td>${code}</td><td>${name}</td><td>${debitAmount > 0 ? formatMoney(debitAmount) : '0.00'}</td><td>${creditAmount > 0 ? formatMoney(creditAmount) : '0.00'}</td></tr>`;
        }
    });
    const reportHtml = `<h3>ميزان المراجعة</h3><table><tr><th>الكود</th><th>الحساب</th><th>مدين</th><th>دائن</th></tr>${rows}<tr style="font-weight:bold"><td colspan="2">الإجمالي</td><td>${formatMoney(totalDebit)}</td><td>${formatMoney(totalCredit)}</td></tr></table>`;
    content.innerHTML = `<div class="card"><h3>ميزان المراجعة</h3><button onclick="printContent(document.getElementById('reportContent').innerHTML, 'ميزان المراجعة')">طباعة</button> <button onclick="reportsPage()">رجوع</button></div><div class="card" id="reportContent">${reportHtml}</div>`;
}

// ميزان المراجعة بالحركة (هرمي)
function trialBalanceWithMovementHierarchical() { renderDateFilter('showTrialBalanceWithMovementHierarchical()'); }
function showTrialBalanceWithMovementHierarchical() {
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const accounts = query(`SELECT id, code, name, type, parent_id FROM chart_of_accounts WHERE is_active = 1 ORDER BY code`);
    const accountMap = {}; const rootAccounts = [];
    accounts.forEach(acc => {
        const id = acc[0], code = acc[1], name = acc[2], type = acc[3], parentId = acc[4];
        const obj = { id, code, name, type, parentId, children: [] };
        accountMap[id] = obj;
        if (parentId === null) rootAccounts.push(obj);
    });
    accounts.forEach(acc => { const id = acc[0], parentId = acc[4]; if (parentId !== null && accountMap[parentId]) accountMap[parentId].children.push(accountMap[id]); });

    function aggregate(node) {
        let opening = 0, debit = 0, credit = 0;
        if (node.children.length === 0) {
            opening = getOpeningBalanceForAccount(node.id, fromDate);
            const move = getMovementForAccountWithVouchers(node.id, fromDate, toDate);
            debit = move.debit; credit = move.credit;
        } else {
            node.children.forEach(child => {
                const childData = aggregate(child);
                opening += childData.opening; debit += childData.debit; credit += childData.credit;
            });
        }
        node.opening = opening; node.debit = debit; node.credit = credit; node.closing = opening + debit - credit;
        return { opening, debit, credit };
    }
    rootAccounts.forEach(root => aggregate(root));

    let rows = '';
    function renderTree(nodes, level = 0) {
        nodes.forEach(node => {
            const indent = '— '.repeat(level);
            const type = node.type;
            let openDisp = node.opening, debDisp = node.debit, credDisp = node.credit, closeDisp = node.closing;
            if (type === 'Liability' || type === 'Equity' || type === 'Revenue') {
                openDisp = -node.opening; debDisp = node.credit; credDisp = node.debit; closeDisp = -node.closing;
            }
            rows += `<tr><td>${node.code}</td><td>${indent}${node.name}</td><td>${openDisp !== 0 ? formatMoney(Math.abs(openDisp)) : ''}</td><td>${debDisp !== 0 ? formatMoney(debDisp) : ''}</td><td>${credDisp !== 0 ? formatMoney(credDisp) : ''}</td><td>${closeDisp !== 0 ? formatMoney(Math.abs(closeDisp)) : ''}</td></tr>`;
            if (node.children.length) renderTree(node.children, level + 1);
        });
    }
    renderTree(rootAccounts);

    const reportHtml = `<h3>ميزان المراجعة بالحركة من ${fromDate} إلى ${toDate}</h3><table><tr><th>الكود</th><th>اسم الحساب</th><th>افتتاحي</th><th>مدين</th><th>دائن</th><th>نهائي</th></tr>${rows}</table>`;
    document.getElementById('reportResult').innerHTML = `<button onclick="printContent(document.getElementById('reportContent').innerHTML, 'ميزان المراجعة بالحركة')">طباعة</button><button onclick="exportToCSV('trial_balance_movement.csv')">تصدير CSV</button><div id="reportContent">${reportHtml}</div>`;
}

// ======================== قائمة الدخل - عرض هرمي احترافي ========================
function incomeStatementReport() { renderDateFilter('showIncomeStatement()'); }

function showIncomeStatement() {
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    
    // 1. بناء الشجرة الكاملة للحسابات النشطة
    const allAccounts = query(`SELECT id, code, name, type, parent_id FROM chart_of_accounts WHERE is_active = 1 ORDER BY code`);
    const accountMap = {};
    const roots = [];
    allAccounts.forEach(acc => {
        const id = acc[0], code = acc[1], name = acc[2], type = acc[3], parentId = acc[4];
        const node = { id, code, name, type, parentId, children: [], balance: 0 };
        accountMap[id] = node;
        if (parentId === null) roots.push(node);
    });
    allAccounts.forEach(acc => { const id = acc[0], parentId = acc[4]; if (parentId !== null && accountMap[parentId]) accountMap[parentId].children.push(accountMap[id]); });

    // 2. دوال مساعدة لحساب الحركة وصافي الحساب
    function getNodeMovement(node) {
        const move = getMovementForAccountWithVouchers(node.id, fromDate, toDate);
        if (node.type === 'Revenue') {
            node.net = move.credit - move.debit; // الإيراد = دائن - مدين
        } else {
            node.net = move.debit - move.credit; // المصروف = مدين - دائن
        }
        return node.net;
    }

    function calculateTree(nodes) {
        let total = 0;
        nodes.forEach(node => {
            if (node.children.length === 0) {
                total += getNodeMovement(node);
            } else {
                node.children.forEach(child => {
                    if (child.children.length === 0) {
                        // حساب فرعي طرفي
                        getNodeMovement(child);
                    } else {
                        // حساب فرعي تجميعي
                        calculateTree([child]);
                    }
                });
                // حساب صافي الحساب التجميعي
                if (node.type === 'Revenue') {
                    // للإيرادات: نجمع دائن - مدين لجميع الأبناء (المخفضة تُطرح تلقائياً)
                    node.net = node.children.reduce((sum, child) => sum + (child.net || 0), 0);
                } else {
                    // للمصروفات: نجمع مدين - دائن لجميع الأبناء
                    node.net = node.children.reduce((sum, child) => sum + (child.net || 0), 0);
                }
                total += node.net;
            }
        });
        return total;
    }

    // 3. استخراج جذور الإيرادات والمصروفات
    const revenueRoot = roots.find(n => n.type === 'Revenue');
    const expenseRoot = roots.find(n => n.type === 'Expense');

    // 4. بناء صفوف العرض بشكل هرمي
    function renderTree(nodes, level = 0) {
        let html = '';
        nodes.forEach(node => {
            const indent = '— '.repeat(level);
            const amount = node.net || 0;
            const isGroup = node.children.length > 0;
            const boldStyle = isGroup ? 'font-weight:bold;' : '';
            const displayAmount = (amount !== 0 || isGroup) ? formatMoney(amount) : '';
            html += `<tr style="${boldStyle}">
                <td>${node.code}</td>
                <td>${indent}${node.name}</td>
                <td style="text-align:right;">${displayAmount}</td>
            </tr>`;
            if (isGroup) {
                html += renderTree(node.children, level + 1);
            }
        });
        return html;
    }

    // 5. حساب الشجرتين
    let totalRevenue = 0, totalExpense = 0;
    let revRows = '', expRows = '';
    
    if (revenueRoot) {
        totalRevenue = calculateTree(revenueRoot.children);
        revRows = renderTree(revenueRoot.children);
    }
    if (expenseRoot) {
        totalExpense = calculateTree(expenseRoot.children);
        expRows = renderTree(expenseRoot.children);
    }

    // 6. صافي الدخل (من الدالة الموحدة للتأكيد)
    const netIncome = totalRevenue - totalExpense;
    
    const reportHtml = `
        <h3>قائمة الدخل من ${fromDate} إلى ${toDate}</h3>
        <h4>الإيرادات</h4>
        <table class="report-table">
            <thead><tr><th>الكود</th><th>الحساب</th><th>المبلغ</th></tr></thead>
            <tbody>
                ${revRows}
                <tr style="font-weight:bold; border-top:2px solid #000;"><td colspan="2">إجمالي الإيرادات</td><td style="text-align:right;">${formatMoney(totalRevenue)}</td></tr>
            </tbody>
        </table>
        
        <h4 style="margin-top:30px;">المصروفات</h4>
        <table class="report-table">
            <thead><tr><th>الكود</th><th>الحساب</th><th>المبلغ</th></tr></thead>
            <tbody>
                ${expRows}
                <tr style="font-weight:bold; border-top:2px solid #000;"><td colspan="2">إجمالي المصروفات</td><td style="text-align:right;">${formatMoney(totalExpense)}</td></tr>
            </tbody>
        </table>
        
        <div style="margin-top:25px; padding:15px; background:#e8f5e9; border-radius:10px; text-align:center;">
            <h4>صافي الربح / الخسارة</h4>
            <h2 style="color:${netIncome >= 0 ? '#2e7d32' : '#c62828'};">${formatMoney(netIncome)}</h2>
        </div>`;
    
    document.getElementById('reportResult').innerHTML = `
        <button onclick="printContent(document.getElementById('reportContent').innerHTML, 'قائمة الدخل')"><i class="fas fa-print"></i> طباعة</button>
        <button onclick="incomeStatementReport()"><i class="fas fa-calendar-alt"></i> تغيير الفترة</button>
        <div id="reportContent">${reportHtml}</div>`;
}

// ======================== الميزانية العمومية هرمية ========================
function balanceSheetReport() {
    const allAccounts = query(`SELECT id, code, name, type, parent_id FROM chart_of_accounts WHERE is_active = 1 ORDER BY code`);
    const accountMap = {}; const roots = [];
    allAccounts.forEach(acc => {
        const id = acc[0], code = acc[1], name = acc[2], type = acc[3], parentId = acc[4];
        const node = { id, code, name, type, parentId, children: [], balance: 0 };
        accountMap[id] = node;
        if (parentId === null) roots.push(node);
    });
    allAccounts.forEach(acc => { const id = acc[0], parentId = acc[4]; if (parentId !== null && accountMap[parentId]) accountMap[parentId].children.push(accountMap[id]); });

    function calculateBalances(node) {
        if (node.children.length === 0) {
            node.balance = window.getAccountBalance ? window.getAccountBalance(node.id) : 0;
        } else {
            node.children.forEach(child => calculateBalances(child));
            node.balance = node.children.reduce((sum, child) => sum + child.balance, 0);
        }
    }
    roots.forEach(root => calculateBalances(root));

    const assetRoot = roots.find(n => n.type === 'Asset');
    const liabilityRoot = roots.find(n => n.type === 'Liability');
    const equityRoot = roots.find(n => n.type === 'Equity');

    function renderHierarchicalRows(nodes, level = 0) {
        let html = '';
        nodes.forEach(node => {
            const indent = '— '.repeat(level);
            const amount = Math.abs(node.balance);
            html += `<tr><td>${node.code}</td><td>${indent}${node.name}</td><td>${formatMoney(amount)}</td></tr>`;
            if (node.children.length > 0) html += renderHierarchicalRows(node.children, level + 1);
        });
        return html;
    }

    let assetRows = assetRoot ? renderHierarchicalRows(assetRoot.children) : '';
    let liabilityRows = liabilityRoot ? renderHierarchicalRows(liabilityRoot.children) : '';
    let equityRows = equityRoot ? renderHierarchicalRows(equityRoot.children) : '';

    const totalAssets = assetRoot ? Math.abs(assetRoot.balance) : 0;
    const totalLiabilities = liabilityRoot ? Math.abs(liabilityRoot.balance) : 0;

    // جلب صافي الدخل من نفس دالة قائمة الدخل
    const netIncome = getNetIncome(
        document.getElementById('fromDate')?.value || today(),
        document.getElementById('toDate')?.value || today()
    );

    let totalEquity = (equityRoot ? Math.abs(equityRoot.balance) : 0) + netIncome;
    equityRows += `<tr><td colspan="2"><strong>صافي الربح / الخسارة (من قائمة الدخل)</strong></td><td><strong>${formatMoney(netIncome)}</strong></td></tr>`;

    const reportHtml = `<h3>الميزانية العمومية</h3>
        <h4>الأصول</h4>
        <table><tr><th>الكود</th><th>الحساب</th><th>المبلغ</th></tr>${assetRows}<tr style="font-weight:bold"><td colspan="2">إجمالي الأصول</td><td>${formatMoney(totalAssets)}</td></tr></table>
        <h4>الخصوم</h4>
        <table><tr><th>الكود</th><th>الحساب</th><th>المبلغ</th></tr>${liabilityRows}<tr style="font-weight:bold"><td colspan="2">إجمالي الخصوم</td><td>${formatMoney(totalLiabilities)}</td></tr></table>
        <h4>حقوق الملكية</h4>
        <table><tr><th>الكود</th><th>الحساب</th><th>المبلغ</th></tr>${equityRows}<tr style="font-weight:bold"><td colspan="2">إجمالي حقوق الملكية</td><td>${formatMoney(totalEquity)}</td></tr></table>
        <h4>مجموع الخصوم وحقوق الملكية</h4><h2>${formatMoney(totalLiabilities + totalEquity)}</h2>`;
    content.innerHTML = `<div class="card"><h3>الميزانية العمومية</h3><button onclick="printContent(document.getElementById('reportContent').innerHTML, 'الميزانية العمومية')">طباعة</button> <button onclick="reportsPage()">رجوع</button></div><div class="card" id="reportContent">${reportHtml}</div>`;
}

// ======================== دوال الطباعة وتصدير CSV (محسنتين) ========================
function printContent(html, title) {
    // تحضير وسم الصورة إذا كان الشعار موجوداً
    const logoHtml = company?.logo ? `<img src="${company.logo}" style="height:60px; margin-left:10px;">` : '';
    
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>${title}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; direction: rtl; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                td, th { border: 1px solid #ddd; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
                h3, h4 { text-align: center; }
                .company-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="company-header">
                <div>
                    <h2>${company?.name || ''}</h2>
                    <p>${company?.phone || ''}</p>
                    <p>${company?.address || ''}</p>
                </div>
                <div>${logoHtml}</div>
            </div>
            ${html}
            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function exportToCSV(filename) {
    const table = document.querySelector('#reportContent table');
    if (!table) {
        alert('لا يوجد جدول لتصديره');
        return;
    }
    let csv = [];
    const titleElement = document.querySelector('#reportContent h3');
    if (titleElement) {
        csv.push(['"' + titleElement.innerText.replace(/"/g, '""') + '"']);
    }
    for (let row of table.rows) {
        let cols = [];
        for (let cell of row.cells) {
            let text = cell.innerText.replace(/"/g, '""');
            if (text.includes(',') || text.includes('\n')) {
                text = `"${text}"`;
            }
            cols.push(text);
        }
        csv.push(cols.join(','));
    }
    const blob = new Blob(['\uFEFF' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 100);
}

// تعريض الدوال
window.printContent = printContent;
window.exportToCSV = exportToCSV;

// تعريض باقي الدوال (كما هي)
window.reportsPage = reportsPage;
window.stockValuationReport = stockValuationReport;
window.stockMovementReport = stockMovementReport;
window.lowStockReport = lowStockReport;
window.salesByDateReport = salesByDateReport;
window.salesByCustomerReport = salesByCustomerReport;
window.salesByItemReport = salesByItemReport;
window.purchasesByDateReport = purchasesByDateReport;
window.purchasesBySupplierReport = purchasesBySupplierReport;
window.purchasesByItemReport = purchasesByItemReport;
window.accountStatementReport = accountStatementReport;
window.dailyJournalReport = dailyJournalReport;
window.generalLedgerReport = generalLedgerReport;
window.trialBalanceReport = trialBalanceReport;
window.trialBalanceWithMovementHierarchical = trialBalanceWithMovementHierarchical;
window.incomeStatementReport = incomeStatementReport;
window.balanceSheetReport = balanceSheetReport;
window.showStockMovement = showStockMovement;
window.showSalesByDate = showSalesByDate;
window.showSalesByCustomer = showSalesByCustomer;
window.showSalesByItem = showSalesByItem;
window.showPurchasesByDate = showPurchasesByDate;
window.showPurchasesBySupplier = showPurchasesBySupplier;
window.showPurchasesByItem = showPurchasesByItem;
window.showAccountStatement = showAccountStatement;
window.showDailyJournal = showDailyJournal;
window.showGeneralLedger = showGeneralLedger;
window.showTrialBalanceWithMovementHierarchical = showTrialBalanceWithMovementHierarchical;
window.showIncomeStatement = showIncomeStatement;