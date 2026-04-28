// cash.js - وحدة إدارة الصندوق (نسخة SQLite - محسنة)
console.log('💰 تحميل وحدة الصندوق...');

// ======================== دوال تهيئة ========================
function initCash() {
    ensureCashTables();
}

function ensureCashTables() {
    run(`
        CREATE TABLE IF NOT EXISTS cash_boxes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            account_id INTEGER NOT NULL,
            currency_id INTEGER DEFAULT 1,
            opening_balance REAL DEFAULT 0,
            notes TEXT,
            deleted INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT,
            deleted_at TEXT,
            FOREIGN KEY(account_id) REFERENCES chart_of_accounts(id)
        )
    `);
    
    run(`
        CREATE TABLE IF NOT EXISTS cash_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cash_box_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            type TEXT,
            ref_number TEXT,
            debit REAL DEFAULT 0,
            credit REAL DEFAULT 0,
            description TEXT,
            FOREIGN KEY(cash_box_id) REFERENCES cash_boxes(id)
        )
    `);
}

// ======================== دوال مساعدة ========================
function getNextCashBoxNumber() {
    const result = query("SELECT number FROM cash_boxes ORDER BY id DESC LIMIT 1");
    if (!result.length) return "CB-000001";
    const last = result[0][0];
    const num = parseInt(last.replace('CB-', '')) + 1;
    return "CB-" + String(num).padStart(6, '0');
}

function getCashBoxBalance(boxId) {
    const box = query(`SELECT account_id, opening_balance FROM cash_boxes WHERE id = ?`, [boxId])[0];
    if (!box) return 0;
    
    const accountId = box[0];
    // ببساطة نعيد رصيد الحساب المرتبط من chart_of_accounts (الذي يتم تحديثه عبر updateAccountBalance)
    const balanceRow = query(`SELECT current_balance FROM chart_of_accounts WHERE id = ?`, [accountId]);
    return balanceRow.length ? balanceRow[0][0] : (box[1] || 0);
}

function getCashAccountOptions(selectedId = null) {
    // عرض الحسابات النقدية فقط: الصندوق والبنوك
    const accs = query(`
        SELECT id, code, name FROM chart_of_accounts 
        WHERE is_active = 1 AND (code LIKE '111%' OR code LIKE '112%')
        ORDER BY code
    `);
    return accs.map(a => `<option value="${a[0]}" ${a[0]===selectedId?'selected':''}>${a[1]} - ${a[2]}</option>`).join('');
}

// ======================== صفحة الصندوق الرئيسية ========================
function cashPage() {
    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-money-bill"></i> إدارة الصندوق</h2>
            <button onclick="cashBoxesListPage()"><i class="fas fa-boxes"></i> إدارة الصناديق</button>
            <button onclick="cashBalancePage()"><i class="fas fa-balance-scale"></i> رصيد الصناديق</button>
            <button onclick="transferBetweenCashBoxesForm()"><i class="fas fa-exchange-alt"></i> تحويل بين الصناديق</button>
            <button onclick="cashReportsPage()"><i class="fas fa-chart-bar"></i> تقارير الصندوق</button>
            <br><br>
            <button onclick="dashboard()">↩️ رجوع</button>
        </div>
    `;
}

function cashBoxesListPage() {
    const boxes = query(`
        SELECT c.id, c.number, c.name, a.code, a.name as account_name, c.currency_id, c.opening_balance
        FROM cash_boxes c
        JOIN chart_of_accounts a ON c.account_id = a.id
        WHERE c.deleted = 0
        ORDER BY c.number
    `);
    
    let rows = '';
    boxes.forEach(b => {
        rows += `<tr>
            <td>${b[1]}</td><td>${b[2]}</td><td>${b[3]} - ${b[4]}</td><td>${getCurrencyName(b[5])}</td>
            <td>${formatMoney(b[6] || 0)}</td>
            <td>
                <button onclick="viewCashBox(${b[0]})">عرض</button>
                <button onclick="cashTransactionsPage(${b[0]})">سجل الحركة</button>
                <button onclick="cashInventoryPage(${b[0]})">جرد</button>
                <button onclick="editCashBox(${b[0]})">تعديل</button>
                <button onclick="deleteCashBox(${b[0]})">حذف</button>
            </td>
        </tr>`;
    });
    
    content.innerHTML = `
        <div class="card">
            <h2>إدارة الصناديق</h2>
            <button onclick="addCashBoxForm()">➕ إضافة صندوق</button>
            <button onclick="cashPage()">↩️ رجوع</button>
        </div>
        <div class="card">
            <table>
                <tr><th>الرقم</th><th>الاسم</th><th>الحساب</th><th>العملة</th><th>الرصيد الافتتاحي</th><th>إجراءات</th></tr>
                ${rows || '<tr><td colspan="6">لا توجد صناديق</td></tr>'}
            </table>
        </div>
    `;
}

function addCashBoxForm() {
    const nextNumber = getNextCashBoxNumber();
    const accountOptions = getCashAccountOptions();
    
    content.innerHTML = `
        <div class="card">
            <h2>إضافة صندوق</h2>
            <label>رقم الصندوق</label><input id="cashBoxNumber" value="${nextNumber}" readonly>
            <label>اسم الصندوق</label><input id="cashBoxName">
            <label>الحساب المرتبط</label><select id="cashBoxAccount">${accountOptions}</select>
            <label>العملة</label><select id="cashBoxCurrency">${getCurrencyOptions()}</select>
            <label>الرصيد الافتتاحي</label><input id="cashBoxOpeningBalance" type="number" value="0">
            <label>ملاحظات</label><input id="cashBoxNotes">
            <br><br>
            <button onclick="saveCashBox()">حفظ</button>
            <button onclick="cashBoxesListPage()">إلغاء</button>
        </div>
    `;
}

function saveCashBox() {
    const number = document.getElementById('cashBoxNumber').value;
    const name = document.getElementById('cashBoxName').value;
    const accountId = parseInt(document.getElementById('cashBoxAccount').value);
    const currencyId = parseInt(document.getElementById('cashBoxCurrency').value);
    const openingBalance = parseFloat(document.getElementById('cashBoxOpeningBalance').value) || 0;
    const notes = document.getElementById('cashBoxNotes').value;
    
    if (!name) { alert('الرجاء إدخال اسم الصندوق'); return; }
    
    run(`
        INSERT INTO cash_boxes (number, name, account_id, currency_id, opening_balance, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [number, name, accountId, currencyId, openingBalance, notes]);
    
    // تحديث رصيد الحساب المرتبط بالرصيد الافتتاحي
    if (openingBalance > 0) {
        window.updateAccountBalance(accountId, openingBalance, 'debit');
    }
    
    saveDatabase();
    addLog('إضافة صندوق', name);
    alert('تم حفظ الصندوق');
    cashBoxesListPage();
}

function viewCashBox(id) {
    const box = query(`
        SELECT c.number, c.name, a.code, a.name, c.currency_id, c.opening_balance, c.notes
        FROM cash_boxes c
        JOIN chart_of_accounts a ON c.account_id = a.id
        WHERE c.id = ?
    `, [id])[0];
    if (!box) { alert('الصندوق غير موجود'); return; }
    
    const currentBalance = getCashBoxBalance(id);
    
    content.innerHTML = `
        <div class="card">
            <h2>عرض بيانات الصندوق</h2>
            <p><strong>الرقم:</strong> ${box[0]}</p>
            <p><strong>الاسم:</strong> ${box[1]}</p>
            <p><strong>الحساب المرتبط:</strong> ${box[2]} - ${box[3]}</p>
            <p><strong>العملة:</strong> ${getCurrencyName(box[4])}</p>
            <p><strong>الرصيد الافتتاحي:</strong> ${formatMoney(box[5] || 0)}</p>
            <p><strong>الرصيد الحالي:</strong> ${formatMoney(currentBalance)}</p>
            <p><strong>ملاحظات:</strong> ${box[6] || '-'}</p>
            <br>
            <button onclick="editCashBox(${id})">تعديل</button>
            <button onclick="deleteCashBox(${id})">حذف</button>
            <button onclick="cashBoxesListPage()">رجوع</button>
        </div>
    `;
}

function editCashBox(id) {
    const box = query(`
        SELECT number, name, account_id, currency_id, opening_balance, notes
        FROM cash_boxes WHERE id = ?
    `, [id])[0];
    if (!box) { alert('الصندوق غير موجود'); return; }
    
    const accountOptions = getCashAccountOptions(box[2]);
    
    content.innerHTML = `
        <div class="card">
            <h2>تعديل الصندوق</h2>
            <label>رقم الصندوق</label><input id="cashBoxNumber" value="${box[0]}" readonly>
            <label>اسم الصندوق</label><input id="cashBoxName" value="${box[1]}">
            <label>الحساب المرتبط</label><select id="cashBoxAccount">${accountOptions}</select>
            <label>العملة</label><select id="cashBoxCurrency">${getCurrencyOptions(box[3])}</select>
            <label>الرصيد الافتتاحي</label><input id="cashBoxOpeningBalance" type="number" value="${box[4]}">
            <label>ملاحظات</label><input id="cashBoxNotes" value="${box[5] || ''}">
            <br><br>
            <button onclick="updateCashBox(${id})">حفظ</button>
            <button onclick="cashBoxesListPage()">إلغاء</button>
        </div>
    `;
}

function updateCashBox(id) {
    const name = document.getElementById('cashBoxName').value;
    const accountId = parseInt(document.getElementById('cashBoxAccount').value);
    const currencyId = parseInt(document.getElementById('cashBoxCurrency').value);
    const openingBalance = parseFloat(document.getElementById('cashBoxOpeningBalance').value) || 0;
    const notes = document.getElementById('cashBoxNotes').value;
    
    // الرصيد الافتتاحي القديم
    const oldBox = query(`SELECT account_id, opening_balance FROM cash_boxes WHERE id = ?`, [id])[0];
    const oldAccountId = oldBox[0];
    const oldBalance = oldBox[1] || 0;
    
    run(`
        UPDATE cash_boxes SET name = ?, account_id = ?, currency_id = ?, opening_balance = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [name, accountId, currencyId, openingBalance, notes, id]);
    
    // تعديل الأرصدة حسب التغيير في الحساب أو الرصيد الافتتاحي
    if (oldAccountId === accountId) {
        // نفس الحساب، نعكس الفرق
        const diff = openingBalance - oldBalance;
        if (diff > 0) window.updateAccountBalance(accountId, diff, 'debit');
        else if (diff < 0) window.updateAccountBalance(accountId, -diff, 'credit');
    } else {
        // تغيير الحساب: عكس القديم بالكامل وتطبيق الجديد
        if (oldBalance > 0) window.updateAccountBalance(oldAccountId, oldBalance, 'credit');
        if (openingBalance > 0) window.updateAccountBalance(accountId, openingBalance, 'debit');
    }
    
    saveDatabase();
    addLog('تعديل صندوق', name);
    alert('تم التعديل');
    cashBoxesListPage();
}

function deleteCashBox(id) {
    const box = query(`SELECT account_id, name FROM cash_boxes WHERE id = ?`, [id])[0];
    if (!box) return;
    const accountId = box[0];
    
    const hasTransactions = query(`
        SELECT COUNT(*) FROM vouchers
        WHERE deleted = 0 AND (cash_account_id = ? OR account_id = ? OR debit_account_id = ? OR credit_account_id = ?)
    `, [accountId, accountId, accountId, accountId])[0][0];
    
    if (hasTransactions > 0) {
        alert('لا يمكن حذف الصندوق لوجود حركات مالية مرتبطة به');
        return;
    }
    
    if (!confirm('هل تريد حذف هذا الصندوق؟')) return;
    
    // عكس الرصيد الافتتاحي من الحساب
    const opening = query(`SELECT opening_balance FROM cash_boxes WHERE id = ?`, [id])[0][0] || 0;
    if (opening > 0) window.updateAccountBalance(accountId, opening, 'credit');
    
    run(`UPDATE cash_boxes SET deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
    saveDatabase();
    addLog('حذف صندوق', box[1]);
    alert('تم الحذف');
    cashBoxesListPage();
}

function cashBalancePage() {
    const boxes = query(`
        SELECT c.id, c.number, c.name, c.currency_id
        FROM cash_boxes c
        WHERE c.deleted = 0
        ORDER BY c.number
    `);
    
    let rows = '';
    boxes.forEach(b => {
        const balance = getCashBoxBalance(b[0]);
        rows += `<tr><td>${b[1]}</td><td>${b[2]}</td><td>${getCurrencyName(b[3])}</td><td>${formatMoney(balance)}</td></tr>`;
    });
    
    content.innerHTML = `
        <div class="card">
            <h2>رصيد الصناديق الحالي</h2>
            <button onclick="cashPage()">رجوع</button>
        </div>
        <div class="card">
            <table>
                <tr><th>الرقم</th><th>الاسم</th><th>العملة</th><th>الرصيد</th></tr>
                ${rows || '<tr><td colspan="4">لا توجد صناديق</td></tr>'}
            </table>
        </div>
    `;
}

function cashTransactionsPage(boxId) {
    const box = query(`SELECT name, account_id, opening_balance FROM cash_boxes WHERE id = ?`, [boxId])[0];
    if (!box) return;
    
    // تجميع الحركات من vouchers
    const vouchers = query(`
        SELECT date, voucher_type, voucher_number, amount, advance_type, cash_account_id, account_id, debit_account_id, credit_account_id
        FROM vouchers
        WHERE deleted = 0 AND (cash_account_id = ? OR account_id = ? OR debit_account_id = ? OR credit_account_id = ?)
        ORDER BY date
    `, [box[1], box[1], box[1], box[1]]);
    
    let rows = '';
    let balance = box[2] || 0;
    
    rows += `<tr><td>-</td><td>رصيد افتتاحي</td><td>-</td><td>${formatMoney(balance)}</td><td>0</td><td>${formatMoney(balance)}</td></tr>`;
    
    vouchers.forEach(v => {
        const date = v[0];
        const type = v[1];
        const number = v[2];
        const amount = v[3];
        const advanceType = v[4];
        const cashAcc = v[5];
        const accId = v[6];
        const debitAcc = v[7];
        const creditAcc = v[8];
        
        let debit = 0, credit = 0;
        let typeName = '';
        
        if (type === 'Receipt' && cashAcc === box[1]) { debit = amount; typeName = 'قبض'; }
        else if (type === 'Payment' && cashAcc === box[1]) { credit = amount; typeName = 'صرف'; }
        else if (type === 'Advance') {
            if (advanceType === 'received' && cashAcc === box[1]) { debit = amount; typeName = 'عربون مقبوض'; }
            else if (advanceType === 'paid' && cashAcc === box[1]) { credit = amount; typeName = 'عربون مدفوع'; }
        } else if (type === 'Settlement') {
            if (debitAcc === box[1]) { debit = amount; typeName = 'تسوية (مدين)'; }
            else if (creditAcc === box[1]) { credit = amount; typeName = 'تسوية (دائن)'; }
        }
        
        if (debit === 0 && credit === 0) return;
        
        balance = balance + debit - credit;
        rows += `<tr><td>${date}</td><td>${typeName}</td><td>${number}</td><td>${formatMoney(debit)}</td><td>${formatMoney(credit)}</td><td>${formatMoney(balance)}</td></tr>`;
    });
    
    content.innerHTML = `
        <div class="card">
            <h2>سجل حركة الصندوق: ${box[0]}</h2>
            <button onclick="cashBoxesListPage()">رجوع</button>
        </div>
        <div class="card">
            <table>
                <tr><th>التاريخ</th><th>النوع</th><th>الرقم</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr>
                ${rows}
            </table>
        </div>
    `;
}

function cashInventoryPage(boxId) {
    const box = query(`SELECT name FROM cash_boxes WHERE id = ?`, [boxId])[0];
    if (!box) return;
    const bookBalance = getCashBoxBalance(boxId);
    
    content.innerHTML = `
        <div class="card">
            <h2>جرد الصندوق: ${box[0]}</h2>
            <p>الرصيد الدفتري: <strong>${formatMoney(bookBalance)}</strong></p>
            <label>الرصيد الفعلي</label><input id="actualCashBalance" type="number" value="0">
            <br><br>
            <button onclick="calculateCashDifference(${boxId})">حساب الفرق</button>
            <button onclick="cashBoxesListPage()">رجوع</button>
        </div>
    `;
}

function calculateCashDifference(boxId) {
    const actual = parseFloat(document.getElementById('actualCashBalance').value) || 0;
    const book = getCashBoxBalance(boxId);
    const diff = actual - book;
    let msg = diff === 0 ? 'الصندوق متطابق' : (diff > 0 ? `زيادة ${formatMoney(diff)}` : `نقص ${formatMoney(-diff)}`);
    alert(msg);
}

function cashReportsPage() {
    const boxes = query(`SELECT id, number, name FROM cash_boxes WHERE deleted = 0`);
    let options = '';
    boxes.forEach(b => options += `<option value="${b[0]}">${b[1]} - ${b[2]}</option>`);
    
    content.innerHTML = `
        <div class="card">
            <h2>تقارير الصندوق</h2>
            <label>الصندوق</label><select id="reportCashBoxId">${options}</select>
            <label>من تاريخ</label><input id="reportFromDate" type="date">
            <label>إلى تاريخ</label><input id="reportToDate" type="date">
            <br><br>
            <button onclick="cashStatementReport()">عرض</button>
            <button onclick="cashPage()">رجوع</button>
        </div>
    `;
}

function cashStatementReport() {
    const boxId = parseInt(document.getElementById('reportCashBoxId').value);
    const fromDate = document.getElementById('reportFromDate').value;
    const toDate = document.getElementById('reportToDate').value;
    const box = query(`SELECT name, account_id, opening_balance FROM cash_boxes WHERE id = ?`, [boxId])[0];
    if (!box) return;
    
    const vouchers = query(`
        SELECT date, voucher_type, voucher_number, amount, advance_type, cash_account_id, account_id, debit_account_id, credit_account_id
        FROM vouchers
        WHERE deleted = 0 AND (cash_account_id = ? OR account_id = ? OR debit_account_id = ? OR credit_account_id = ?)
        ORDER BY date
    `, [box[1], box[1], box[1], box[1]]);
    
    let rows = '';
    let balance = box[2] || 0;
    rows += `<tr><td>-</td><td>رصيد افتتاحي</td><td>-</td><td>${formatMoney(balance)}</td><td>0</td><td>${formatMoney(balance)}</td></tr>`;
    
    vouchers.forEach(v => {
        const date = v[0];
        if (fromDate && date < fromDate) return;
        if (toDate && date > toDate) return;
        
        const type = v[1];
        const number = v[2];
        const amount = v[3];
        const advanceType = v[4];
        const cashAcc = v[5];
        const accId = v[6];
        const debitAcc = v[7];
        const creditAcc = v[8];
        
        let debit = 0, credit = 0;
        let typeName = '';
        
        if (type === 'Receipt' && cashAcc === box[1]) { debit = amount; typeName = 'قبض'; }
        else if (type === 'Payment' && cashAcc === box[1]) { credit = amount; typeName = 'صرف'; }
        else if (type === 'Advance') {
            if (advanceType === 'received' && cashAcc === box[1]) { debit = amount; typeName = 'عربون مقبوض'; }
            else if (advanceType === 'paid' && cashAcc === box[1]) { credit = amount; typeName = 'عربون مدفوع'; }
        } else if (type === 'Settlement') {
            if (debitAcc === box[1]) { debit = amount; typeName = 'تسوية (مدين)'; }
            else if (creditAcc === box[1]) { credit = amount; typeName = 'تسوية (دائن)'; }
        }
        
        if (debit === 0 && credit === 0) return;
        
        balance = balance + debit - credit;
        rows += `<tr><td>${date}</td><td>${typeName}</td><td>${number}</td><td>${formatMoney(debit)}</td><td>${formatMoney(credit)}</td><td>${formatMoney(balance)}</td></tr>`;
    });
    
    content.innerHTML = `
        <div class="card">
            <h2>كشف حساب الصندوق: ${box[0]}</h2>
            <button onclick="window.print()">طباعة</button>
            <button onclick="cashReportsPage()">رجوع</button>
        </div>
        <div class="card">
            <table>
                <tr><th>التاريخ</th><th>النوع</th><th>الرقم</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr>
                ${rows}
            </table>
        </div>
    `;
}

function transferBetweenCashBoxesForm() {
    const boxes = query(`SELECT id, number, name, account_id FROM cash_boxes WHERE deleted = 0`);
    let options = '';
    boxes.forEach(b => options += `<option value="${b[0]}" data-account="${b[3]}">${b[1]} - ${b[2]}</option>`);
    
    content.innerHTML = `
        <div class="card">
            <h2>تحويل بين الصناديق</h2>
            <label>من صندوق</label><select id="fromCashBox">${options}</select>
            <label>إلى صندوق</label><select id="toCashBox">${options}</select>
            <label>التاريخ</label><input id="transferDate" type="date" value="${today()}">
            <label>المبلغ</label><input id="transferAmount" type="number" value="0">
            <label>البيان</label><input id="transferDescription">
            <br><br>
            <button onclick="saveCashTransfer()">تنفيذ</button>
            <button onclick="cashPage()">رجوع</button>
        </div>
    `;
}

function saveCashTransfer() {
    const fromSelect = document.getElementById('fromCashBox');
    const toSelect = document.getElementById('toCashBox');
    const fromId = parseInt(fromSelect.value);
    const toId = parseInt(toSelect.value);
    const fromAccount = parseInt(fromSelect.options[fromSelect.selectedIndex].dataset.account);
    const toAccount = parseInt(toSelect.options[toSelect.selectedIndex].dataset.account);
    const date = document.getElementById('transferDate').value;
    const amount = parseFloat(document.getElementById('transferAmount').value) || 0;
    const description = document.getElementById('transferDescription').value;
    
    if (fromId === toId) { alert('لا يمكن التحويل لنفس الصندوق'); return; }
    if (amount <= 0) { alert('المبلغ غير صحيح'); return; }
    
    const fromBalance = getCashBoxBalance(fromId);
    if (amount > fromBalance) { alert('الرصيد غير كافٍ'); return; }
    
    const transferNumber = 'TRF-' + Date.now();
    const periodId = query(`SELECT id FROM fiscal_periods WHERE status = 'Open' LIMIT 1`)[0]?.[0];
    
    // إنشاء قيد محاسبي للتحويل (مدين الصندوق المستهدف، دائن الصندوق المصدر)
    const entryNumber = 'JV-TRF-' + transferNumber;
    run(`INSERT INTO journal_entries (entry_number, date, description, period_id, status, auto_generated)
         VALUES (?, ?, ?, ?, 'Posted', 1)`,
        [entryNumber, date, `تحويل بين الصناديق: ${description || '-'}`, periodId]);
    const entryId = query(`SELECT last_insert_rowid()`)[0][0];
    
    run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, toAccount, amount]);
    run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, fromAccount, amount]);
    
    window.updateAccountBalance(toAccount, amount, 'debit');
    window.updateAccountBalance(fromAccount, amount, 'credit');
    
    // تسجيل العملية في vouchers (اختياري للتوافق)
    run(`INSERT INTO vouchers (voucher_number, date, voucher_type, cash_account_id, amount, description, status)
         VALUES (?, ?, 'Payment', ?, ?, ?, 'Posted')`,
        [transferNumber + '-OUT', date, fromAccount, amount, description + ' (تحويل إلى ' + toId + ')']);
    run(`INSERT INTO vouchers (voucher_number, date, voucher_type, cash_account_id, amount, description, status)
         VALUES (?, ?, 'Receipt', ?, ?, ?, 'Posted')`,
        [transferNumber + '-IN', date, toAccount, amount, description + ' (تحويل من ' + fromId + ')']);
    
    saveDatabase();
    addLog('تحويل بين الصناديق', `${formatMoney(amount)} من ${fromId} إلى ${toId}`);
    alert('تم التحويل بنجاح');
    cashPage();
}

// تعريض الدوال
window.initCash = initCash;
window.cashPage = cashPage;
window.cashBoxesListPage = cashBoxesListPage;
window.addCashBoxForm = addCashBoxForm;
window.saveCashBox = saveCashBox;
window.viewCashBox = viewCashBox;
window.editCashBox = editCashBox;
window.updateCashBox = updateCashBox;
window.deleteCashBox = deleteCashBox;
window.cashBalancePage = cashBalancePage;
window.cashTransactionsPage = cashTransactionsPage;
window.cashInventoryPage = cashInventoryPage;
window.calculateCashDifference = calculateCashDifference;
window.cashReportsPage = cashReportsPage;
window.cashStatementReport = cashStatementReport;
window.transferBetweenCashBoxesForm = transferBetweenCashBoxesForm;
window.saveCashTransfer = saveCashTransfer;