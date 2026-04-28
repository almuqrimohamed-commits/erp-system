// journal.js - وحدة دفتر اليومية (نسخة SQLite - محدثة ومُصلحة بالكامل)
console.log('📒 تحميل وحدة دفتر اليومية...');
let isSaving = false;

// ======================== الصفحات الرئيسية ========================
function journalPage() {
    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-book"></i> دفتر اليومية</h2>
            <button onclick="openingEntriesPage()"><i class="fas fa-door-open"></i> قيود افتتاحية</button>
            <button onclick="dailyEntriesPage()"><i class="fas fa-calendar-day"></i> قيود يومية</button>
            <button onclick="deletedEntriesPage()"><i class="fas fa-trash-alt"></i> القيود المحذوفة</button>
            <br><br>
            <button onclick="dashboard()"><i class="fas fa-arrow-right"></i> رجوع</button>
        </div>
    `;
}

function openingEntriesPage() {
    content.innerHTML = `
        <div class="card">
            <h2>القيود الافتتاحية</h2>
            <button onclick="addOpeningEntryForm()"><i class="fas fa-plus"></i> إضافة قيد افتتاحي</button>
            <button onclick="openingEntriesList()"><i class="fas fa-list"></i> عرض القيود الافتتاحية</button>
            <br><br>
            <button onclick="journalPage()">رجوع</button>
        </div>
    `;
}

function dailyEntriesPage() {
    content.innerHTML = `
        <div class="card">
            <h2>القيود اليومية</h2>
            <button onclick="addDailyEntryForm()"><i class="fas fa-plus"></i> إضافة قيد يومي</button>
            <button onclick="dailyEntriesList()"><i class="fas fa-list"></i> عرض القيود اليومية</button>
            <br><br>
            <button onclick="journalPage()">رجوع</button>
        </div>
    `;
}

function deletedEntriesPage() {
    const rows = query(`
        SELECT id, entry_number, date, description
        FROM journal_entries
        WHERE status = 'Deleted'
        ORDER BY date DESC
    `);
    
    let html = '';
    rows.forEach(e => {
        html += `<tr>
            <td>${escapeHtml(e[1])}</td><td>${e[2]}</td><td>${escapeHtml(e[3] || '-')}</td>
            <td>${canDeleteJournal() ? `<button onclick="restoreEntry(${e[0]})">استرجاع</button>` : ''}</td>
        </tr>`;
    });
    
    content.innerHTML = `
        <div class="card">
            <h2>القيود المحذوفة</h2>
            <button onclick="journalPage()">رجوع</button>
        </div>
        <div class="card">
            <table>
                <tr><th>الرقم</th><th>التاريخ</th><th>البيان</th><th>الإجراء</th></tr>
                ${html || '<tr><td colspan="4">لا توجد قيود محذوفة</td></tr>'}
            </table>
        </div>
    `;
}

// ======================== دوال توليد الأرقام ========================
function getNextOpeningEntryNumber() {
    const result = query(`
        SELECT entry_number FROM journal_entries 
        WHERE entry_type = 'opening' 
        ORDER BY id DESC LIMIT 1
    `);
    if (!result.length || !result[0][0]) return "OP-000001";
    const last = result[0][0];
    const num = parseInt(last.replace('OP-', '')) + 1;
    return "OP-" + String(num).padStart(6, '0');
}

function getNextDailyEntryNumber() {
    const result = query(`
        SELECT entry_number FROM journal_entries 
        WHERE entry_type = 'daily' 
        ORDER BY id DESC LIMIT 1
    `);
    if (!result.length || !result[0][0]) return "JV-000001";
    const last = result[0][0];
    const num = parseInt(last.replace('JV-', '')) + 1;
    return "JV-" + String(num).padStart(6, '0');
}

// ======================== دوال إضافة القيود ========================
function addOpeningEntryForm() {
    const nextNumber = getNextOpeningEntryNumber();
    const accountOptions = getAccountOptions();
    
    content.innerHTML = `
        <div class="card">
            <h2>إضافة قيد افتتاحي</h2>
            <label>رقم القيد</label>
            <input id="entryNumber" value="${nextNumber}" readonly>
            <label>التاريخ</label>
            <input id="entryDate" type="date" value="${today()}">
            <label>مرجع</label>
            <input id="entryRef" placeholder="مرجع القيد">
            <label>العملة</label>
            <select id="openingCurrency">${getCurrencyOptions()}</select>
            <label>البيان</label>
            <input id="entryDescription" placeholder="البيان">
            <br><br>
            <div class="card">
                <table id="entryLines">
                    <tr><th>الحساب</th><th>مدين</th><th>دائن</th><th>حذف</th></tr>
                </table>
                <button onclick="addEntryLine()">إضافة سطر</button>
            </div>
            <br>
            <div class="card">
                <h3>إجمالي المدين: <span id="totalDebit">0</span></h3>
                <h3>إجمالي الدائن: <span id="totalCredit">0</span></h3>
                <h3>الفرق: <span id="balanceDiff">0</span></h3>
                <label>المبلغ كتابة</label>
                <input id="amountWords" readonly>
            </div>
            <br>
            <button onclick="saveOpeningEntry()">حفظ</button>
            <button onclick="openingEntriesPage()">رجوع</button>
        </div>
    `;
    addEntryLine();
    updateEntryTotals();
}

function addDailyEntryForm() {
    const nextNumber = getNextDailyEntryNumber();
    const accountOptions = getAccountOptions();
    
    content.innerHTML = `
        <div class="card">
            <h2>إضافة قيد يومي</h2>
            <label>رقم القيد</label>
            <input id="entryNumber" value="${nextNumber}" readonly>
            <label>التاريخ</label>
            <input id="entryDate" type="date" value="${today()}">
            <label>مرجع</label>
            <input id="entryRef" placeholder="مرجع القيد">
            <label>العملة</label>
            <select id="journalCurrency">${getCurrencyOptions()}</select>
            <label>البيان</label>
            <input id="entryDescription" placeholder="البيان">
            <br><br>
            <div class="card">
                <table id="entryLines">
                    <tr><th>الحساب</th><th>مدين</th><th>دائن</th><th>حذف</th></tr>
                </table>
                <button onclick="addEntryLine()">إضافة سطر</button>
            </div>
            <br>
            <div class="card">
                <h3>إجمالي المدين: <span id="totalDebit">0</span></h3>
                <h3>إجمالي الدائن: <span id="totalCredit">0</span></h3>
                <h3>الفرق: <span id="balanceDiff">0</span></h3>
            </div>
            <br>
            <button onclick="saveDailyEntry()">حفظ</button>
            <button onclick="dailyEntriesPage()">رجوع</button>
        </div>
    `;
    addEntryLine();
    updateEntryTotals();
}

// دوال مساعدة للواجهة
function getAccountOptions() {
    const accounts = query(`
        SELECT id, code, name FROM chart_of_accounts 
        WHERE is_active = 1 ORDER BY code
    `);
    return accounts.map(a => `<option value="${a[0]}">${a[1]} - ${a[2]}</option>`).join('');
}

function addEntryLine() {
    const table = document.getElementById('entryLines');
    const row = table.insertRow(-1);
    row.innerHTML = `
        <td><select class="accountSelect">${getAccountOptions()}</select></td>
        <td><input class="debitInput" type="number" value="0" oninput="updateEntryTotals()" step="any"></td>
        <td><input class="creditInput" type="number" value="0" oninput="updateEntryTotals()" step="any"></td>
        <td><button onclick="removeEntryLine(this)">حذف</button></td>
    `;
    updateEntryTotals();
}

function removeEntryLine(btn) {
    btn.closest('tr').remove();
    updateEntryTotals();
}

function updateEntryTotals() {
    const debits = document.querySelectorAll('.debitInput');
    const credits = document.querySelectorAll('.creditInput');
    let totalDebit = 0, totalCredit = 0;
    debits.forEach(el => totalDebit += Number(el.value) || 0);
    credits.forEach(el => totalCredit += Number(el.value) || 0);
    
    document.getElementById('totalDebit').innerText = totalDebit;
    document.getElementById('totalCredit').innerText = totalCredit;
    document.getElementById('balanceDiff').innerText = totalDebit - totalCredit;
    
    const wordsField = document.getElementById('amountWords');
    if (wordsField && typeof numberToArabicWords === 'function') {
        wordsField.value = numberToArabicWords(totalDebit);
    }
}

function collectEntryLines() {
    const lines = [];
    const selects = document.querySelectorAll('.accountSelect');
    const debits = document.querySelectorAll('.debitInput');
    const credits = document.querySelectorAll('.creditInput');
    
    for (let i = 0; i < selects.length; i++) {
        const accountId = Number(selects[i].value);
        const debit = Number(debits[i].value) || 0;
        const credit = Number(credits[i].value) || 0;
        if (debit > 0 && credit > 0) {
            alert('لا يمكن أن يحتوي السطر على مدين ودائن معاً');
            return null;
        }
        if (debit > 0 || credit > 0) {
            lines.push({ accountId, debit, credit });
        }
    }
    if (lines.length === 0) {
        alert('القيد فارغ');
        return null;
    }
    if (lines.length < 2) {
        alert('يجب أن يحتوي القيد على سطرين على الأقل');
        return null;
    }
    return lines;
}

// ======================== حفظ القيود ========================
function saveOpeningEntry() {
    if (isSaving) return;
    isSaving = true;

    const period = query(`SELECT id FROM fiscal_periods WHERE status = 'Open' LIMIT 1`);
    if (!period.length) { alert('لا توجد فترة مالية مفتوحة.'); isSaving = false; return; }
    const periodId = period[0][0];

    const number = document.getElementById('entryNumber').value;
    const date = document.getElementById('entryDate').value;
    const ref = document.getElementById('entryRef').value;
    const currencyId = Number(document.getElementById('openingCurrency').value);
    const description = document.getElementById('entryDescription').value;
    const amountWords = document.getElementById('amountWords')?.value || '';
    
    const lines = collectEntryLines();
    if (!lines) { isSaving = false; return; }
    
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    
    if (totalDebit !== totalCredit) {
        alert(`القيد غير متوازن\nمدين: ${totalDebit}\nدائن: ${totalCredit}`);
        isSaving = false;
        return;
    }
    
    // التحقق من أن التاريخ ضمن الفترة المالية
    const periodDates = query(`SELECT start_date, end_date FROM fiscal_periods WHERE id = ?`, [periodId])[0];
    if (periodDates && (date < periodDates[0] || date > periodDates[1])) {
        alert('تاريخ القيد خارج الفترة المالية المفتوحة');
        isSaving = false; return;
    }
    
    try {
       db.exec("BEGIN");
        
        run(`INSERT INTO journal_entries (entry_number, date, ref, currency_id, description, entry_type, status, amount_words, period_id) VALUES (?, ?, ?, ?, ?, 'opening', 'Posted', ?, ?)`, [number, date, ref, currencyId, description, amountWords, periodId]);
        
        const entryId = query('SELECT last_insert_rowid()')[0][0];
        const stmt = db.prepare(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)`);
        lines.forEach(l => {
            stmt.run([entryId, l.accountId, l.debit, l.credit]);
            if (l.debit > 0) window.updateAccountBalance(l.accountId, l.debit, 'debit');
            if (l.credit > 0) window.updateAccountBalance(l.accountId, l.credit, 'credit');
        });
        stmt.free();
        
       db.exec("COMMIT");
        saveDatabase();
        addLog('إضافة قيد افتتاحي', number);
        alert('تم حفظ القيد الافتتاحي');
        openingEntriesList();
    } catch (error) {
 try { db.exec("ROLLBACK"); } catch(e) {}
        alert('فشل حفظ القيد: ' + error.message);
    }
    isSaving = false;
}

function saveDailyEntry() {
    if (isSaving) return;
    isSaving = true;

    const period = query(`SELECT id FROM fiscal_periods WHERE status = 'Open' LIMIT 1`);
    if (!period.length) { alert('لا توجد فترة مالية مفتوحة.'); isSaving = false; return; }
    const periodId = period[0][0];

    const number = document.getElementById('entryNumber').value;
    const date = document.getElementById('entryDate').value;
    const ref = document.getElementById('entryRef').value;
    const currencyId = Number(document.getElementById('journalCurrency').value);
    const description = document.getElementById('entryDescription').value;
    
    const lines = collectEntryLines();
    if (!lines) { isSaving = false; return; }
    
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    
    if (totalDebit !== totalCredit) {
        alert(`القيد غير متوازن\nمدين: ${totalDebit}\nدائن: ${totalCredit}`);
        isSaving = false;
        return;
    }
    
    // التحقق من أن التاريخ ضمن الفترة المالية
    const periodDates = query(`SELECT start_date, end_date FROM fiscal_periods WHERE id = ?`, [periodId])[0];
    if (periodDates && (date < periodDates[0] || date > periodDates[1])) {
        alert('تاريخ القيد خارج الفترة المالية المفتوحة');
        isSaving = false; return;
    }
    
    try {
       db.exec("BEGIN");
        
        run(`INSERT INTO journal_entries (entry_number, date, ref, currency_id, description, entry_type, status, period_id) VALUES (?, ?, ?, ?, ?, 'daily', 'Posted', ?)`, [number, date, ref, currencyId, description, periodId]);
        
        const entryId = query('SELECT last_insert_rowid()')[0][0];
        const stmt = db.prepare(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)`);
        lines.forEach(l => {
            stmt.run([entryId, l.accountId, l.debit, l.credit]);
            if (l.debit > 0) window.updateAccountBalance(l.accountId, l.debit, 'debit');
            if (l.credit > 0) window.updateAccountBalance(l.accountId, l.credit, 'credit');
        });
        stmt.free();
        
      db.exec("COMMIT");
        saveDatabase();
        addLog('إضافة قيد يومي', number);
        alert('تم حفظ القيد اليومي');
        dailyEntriesList();
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch(e) {}
        alert('فشل حفظ القيد: ' + error.message);
    }
    isSaving = false;
}

// ======================== عرض القوائم ========================
function openingEntriesList() {
    const entries = query(`
        SELECT id, entry_number, date, currency_id, description, 
               (SELECT SUM(debit) FROM journal_entry_lines WHERE entry_id = e.id) as total_debit,
               (SELECT SUM(credit) FROM journal_entry_lines WHERE entry_id = e.id) as total_credit
        FROM journal_entries e
        WHERE entry_type = 'opening' AND status != 'Deleted'
        ORDER BY date DESC, id DESC
    `);
    
    let rows = '';
    entries.forEach(e => {
        rows += `<tr>
            <td>${escapeHtml(e[1])}</td><td>${e[2]}</td><td>${getCurrencyName(e[3])}</td><td>${escapeHtml(e[4] || '-')}</td>
            <td>${formatMoney(e[5])}</td><td>${formatMoney(e[6])}</td>
            <td>
                <button onclick="viewEntry(${e[0]})">عرض</button>
                ${canEditJournal() ? `<button onclick="editEntry(${e[0]})">تعديل</button>` : ''}
                ${canDeleteJournal() ? `<button onclick="deleteEntry(${e[0]})">حذف</button>` : ''}
            </td>
        </tr>`;
    });
    
    content.innerHTML = `
        <div class="card">
            <h2>قائمة القيود الافتتاحية</h2>
            <input id="searchOpeningEntry" placeholder="بحث بالرقم أو التاريخ أو البيان" oninput="searchOpeningEntries()">
            <br><br>
            <button onclick="openingEntriesPage()">رجوع</button>
        </div>
        <div class="card">
            <table id="entriesTable">
                <tr><th>الرقم</th><th>التاريخ</th><th>العملة</th><th>البيان</th><th>مدين</th><th>دائن</th><th>إجراءات</th></tr>
                ${rows || '<tr><td colspan="7">لا توجد قيود</td></tr>'}
            </table>
        </div>
    `;
}

function dailyEntriesList() {
    const entries = query(`
        SELECT id, entry_number, date, description,
               (SELECT SUM(debit) FROM journal_entry_lines WHERE entry_id = e.id) as total_debit,
               (SELECT SUM(credit) FROM journal_entry_lines WHERE entry_id = e.id) as total_credit
        FROM journal_entries e
        WHERE entry_type = 'daily' AND status != 'Deleted'
        ORDER BY date DESC, id DESC
    `);
    
    let rows = '';
    entries.forEach(e => {
        rows += `<tr>
            <td>${escapeHtml(e[1])}</td><td>${e[2]}</td><td>${escapeHtml(e[3] || '-')}</td>
            <td>${formatMoney(e[4])}</td><td>${formatMoney(e[5])}</td>
            <td>
                <button onclick="viewEntry(${e[0]})">عرض</button>
                ${canEditJournal() ? `<button onclick="editEntry(${e[0]})">تعديل</button>` : ''}
                ${canDeleteJournal() ? `<button onclick="deleteEntry(${e[0]})">حذف</button>` : ''}
            </td>
        </tr>`;
    });
    
    content.innerHTML = `
        <div class="card">
            <h2>قائمة القيود اليومية</h2>
            <input id="searchDailyEntry" placeholder="بحث بالرقم أو التاريخ أو البيان" oninput="searchDailyEntries()">
            <br><br>
            <button onclick="dailyEntriesPage()">رجوع</button>
        </div>
        <div class="card">
            <table id="entriesTable">
                <tr><th>الرقم</th><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>إجراءات</th></tr>
                ${rows || '<tr><td colspan="6">لا توجد قيود</td></tr>'}
            </table>
        </div>
    `;
}

function searchOpeningEntries() {
    const text = document.getElementById('searchOpeningEntry').value.toLowerCase();
    const entries = query(`
        SELECT id, entry_number, date, currency_id, description,
               (SELECT SUM(debit) FROM journal_entry_lines WHERE entry_id = e.id) as total_debit,
               (SELECT SUM(credit) FROM journal_entry_lines WHERE entry_id = e.id) as total_credit
        FROM journal_entries e
        WHERE entry_type = 'opening' AND status != 'Deleted'
          AND (LOWER(entry_number) LIKE ? OR LOWER(description) LIKE ? OR date LIKE ?)
        ORDER BY date DESC
    `, [`%${text}%`, `%${text}%`, `%${text}%`]);
    
    renderEntriesTable(entries, true);
}

function searchDailyEntries() {
    const text = document.getElementById('searchDailyEntry').value.toLowerCase();
    const entries = query(`
        SELECT id, entry_number, date, description,
               (SELECT SUM(debit) FROM journal_entry_lines WHERE entry_id = e.id) as total_debit,
               (SELECT SUM(credit) FROM journal_entry_lines WHERE entry_id = e.id) as total_credit
        FROM journal_entries e
        WHERE entry_type = 'daily' AND status != 'Deleted'
          AND (LOWER(entry_number) LIKE ? OR LOWER(description) LIKE ? OR date LIKE ?)
        ORDER BY date DESC
    `, [`%${text}%`, `%${text}%`, `%${text}%`]);
    
    renderEntriesTable(entries, false);
}

function renderEntriesTable(entries, isOpening) {
    let rows = '';
    entries.forEach(e => {
        if (isOpening) {
            rows += `<tr>
                <td>${escapeHtml(e[1])}</td><td>${e[2]}</td><td>${getCurrencyName(e[3])}</td><td>${escapeHtml(e[4] || '-')}</td>
                <td>${formatMoney(e[5])}</td><td>${formatMoney(e[6])}</td>
                <td>
                    <button onclick="viewEntry(${e[0]})">عرض</button>
                    ${canEditJournal() ? `<button onclick="editEntry(${e[0]})">تعديل</button>` : ''}
                    ${canDeleteJournal() ? `<button onclick="deleteEntry(${e[0]})">حذف</button>` : ''}
                </td>
            </tr>`;
        } else {
            rows += `<tr>
                <td>${escapeHtml(e[1])}</td><td>${e[2]}</td><td>${escapeHtml(e[3] || '-')}</td>
                <td>${formatMoney(e[4])}</td><td>${formatMoney(e[5])}</td>
                <td>
                    <button onclick="viewEntry(${e[0]})">عرض</button>
                    ${canEditJournal() ? `<button onclick="editEntry(${e[0]})">تعديل</button>` : ''}
                    ${canDeleteJournal() ? `<button onclick="deleteEntry(${e[0]})">حذف</button>` : ''}
                </td>
            </tr>`;
        }
    });
    document.querySelector('#entriesTable').innerHTML = `
        ${isOpening ? 
            '<tr><th>الرقم</th><th>التاريخ</th><th>العملة</th><th>البيان</th><th>مدين</th><th>دائن</th><th>إجراءات</th></tr>' :
            '<tr><th>الرقم</th><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>إجراءات</th></tr>'
        }
        ${rows}
    `;
}

// ======================== عرض وتعديل وحذف ========================
function viewEntry(id) {
    const entry = query(`
        SELECT entry_number, date, ref, currency_id, description, entry_type, amount_words
        FROM journal_entries WHERE id = ?
    `, [id])[0];
    if (!entry) return;
    
    const lines = query(`
        SELECT a.code, a.name, l.debit, l.credit
        FROM journal_entry_lines l
        JOIN chart_of_accounts a ON l.account_id = a.id
        WHERE l.entry_id = ?
    `, [id]);
    
    let linesHtml = '';
    let totalDebit = 0, totalCredit = 0;
    lines.forEach(l => {
        totalDebit += l[2] || 0;
        totalCredit += l[3] || 0;
        linesHtml += `<tr>
            <td>${escapeHtml(l[0])} - ${escapeHtml(l[1])}</td>
            <td>${formatMoney(l[2])}</td>
            <td>${formatMoney(l[3])}</td>
            <td>${numberToArabicWords(l[2] || l[3])}</td>
        </tr>`;
    });
    
    content.innerHTML = `
        <div class="card">
            <h2>عرض القيد</h2>
            <p><b>الرقم:</b> ${escapeHtml(entry[0])} | <b>التاريخ:</b> ${entry[1]} | <b>المرجع:</b> ${escapeHtml(entry[2] || '-')}</p>
            <p><b>العملة:</b> ${getCurrencyName(entry[3])} | <b>البيان:</b> ${escapeHtml(entry[4] || '-')}</p>
            <p><b>المبلغ كتابة:</b> ${entry[6] || '-'}</p>
            <table>
                <tr><th>الحساب</th><th>مدين</th><th>دائن</th><th>كتابة</th></tr>
                ${linesHtml}
                <tr style="font-weight:bold"><td>الإجمالي</td><td>${formatMoney(totalDebit)}</td><td>${formatMoney(totalCredit)}</td><td></td></tr>
            </table>
            <br>
            <button onclick="printEntry(${id})"><i class="fas fa-print"></i> طباعة</button>
            <button onclick="${entry[5] === 'opening' ? 'openingEntriesList()' : 'dailyEntriesList()'}">رجوع</button>
        </div>
    `;
}

function editEntry(id) {
    const entry = query(`SELECT entry_number, date, ref, currency_id, description, entry_type FROM journal_entries WHERE id = ?`, [id])[0];
    if (!entry) return;
    
    const lines = query(`SELECT account_id, debit, credit FROM journal_entry_lines WHERE entry_id = ?`, [id]);
    
    content.innerHTML = `
        <div class="card">
            <h2>تعديل قيد ${entry[5] === 'opening' ? 'افتتاحي' : 'يومي'}</h2>
            <input type="hidden" id="editEntryId" value="${id}">
            <label>رقم القيد</label>
            <input id="entryNumber" value="${escapeHtml(entry[0])}" readonly>
            <label>التاريخ</label>
            <input id="entryDate" type="date" value="${entry[1]}">
            <label>مرجع</label>
            <input id="entryRef" value="${escapeHtml(entry[2] || '')}">
            <label>العملة</label>
            <select id="editCurrency">${getCurrencyOptions(entry[3])}</select>
            <label>البيان</label>
            <input id="entryDescription" value="${escapeHtml(entry[4] || '')}">
            <br><br>
            <div class="card">
                <table id="entryLines">
                    <tr><th>الحساب</th><th>مدين</th><th>دائن</th><th>حذف</th></tr>
                </table>
                <button onclick="addEntryLine()">إضافة سطر</button>
            </div>
            <br>
            <div class="card">
                <h3>إجمالي المدين: <span id="totalDebit">0</span></h3>
                <h3>إجمالي الدائن: <span id="totalCredit">0</span></h3>
                <h3>الفرق: <span id="balanceDiff">0</span></h3>
            </div>
            <br>
            <button onclick="updateEntry()">حفظ التعديلات</button>
            <button onclick="${entry[5] === 'opening' ? 'openingEntriesList()' : 'dailyEntriesList()'}">رجوع</button>
        </div>
    `;
    
    // إضافة الصفوف القديمة مع قيمها مباشرة
    const table = document.getElementById('entryLines');
    const accountOptions = getAccountOptions();
    lines.forEach(l => {
        const row = table.insertRow(-1);
        row.innerHTML = `
            <td><select class="accountSelect">${accountOptions.replace(`value="${l[0]}"`, `value="${l[0]}" selected`)}</select></td>
            <td><input class="debitInput" type="number" value="${l[1]}" oninput="updateEntryTotals()" step="any"></td>
            <td><input class="creditInput" type="number" value="${l[2]}" oninput="updateEntryTotals()" step="any"></td>
            <td><button onclick="removeEntryLine(this)">حذف</button></td>
        `;
    });
    
    // إذا لم تكن هناك سطور قديمة، أضف صفاً فارغاً
    if (lines.length === 0) {
        addEntryLine();
    }
    
    updateEntryTotals();
}

function updateEntry() {
    const id = Number(document.getElementById('editEntryId').value);
    
    const date = document.getElementById('entryDate').value;
    const ref = document.getElementById('entryRef').value;
    const currencyId = Number(document.getElementById('editCurrency').value);
    const description = document.getElementById('entryDescription').value;
    
    const lines = collectEntryLines();
    if (!lines) return;
    
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    
    if (totalDebit !== totalCredit) {
        alert('القيد غير متوازن');
        return;
    }
    
    try {
      db.exec("BEGIN");
        
        // عكس أثر القيد القديم
        const oldLines = query(`SELECT account_id, debit, credit FROM journal_entry_lines WHERE entry_id = ?`, [id]);
        oldLines.forEach(l => {
            if (l[1] > 0) window.updateAccountBalance(l[0], l[1], 'credit');
            if (l[2] > 0) window.updateAccountBalance(l[0], l[2], 'debit');
        });
        
        run(`UPDATE journal_entries SET date = ?, ref = ?, currency_id = ?, description = ? WHERE id = ?`,
            [date, ref, currencyId, description, id]);
        
        run(`DELETE FROM journal_entry_lines WHERE entry_id = ?`, [id]);
        const stmt = db.prepare(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)`);
        lines.forEach(l => {
            stmt.run([id, l.accountId, l.debit, l.credit]);
            if (l.debit > 0) window.updateAccountBalance(l.accountId, l.debit, 'debit');
            if (l.credit > 0) window.updateAccountBalance(l.accountId, l.credit, 'credit');
        });
        stmt.free();
        
       db.exec("COMMIT");
        saveDatabase();
        addLog('تعديل قيد', id);
        alert('تم التحديث');
        
        const type = query('SELECT entry_type FROM journal_entries WHERE id = ?', [id])[0][0];
        if (type === 'opening') openingEntriesList();
        else dailyEntriesList();
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch(e) {}
        alert('فشل تحديث القيد: ' + error.message);
    }
}

function deleteEntry(id) {
    try {
      db.exec("BEGIN");
        
        // عكس أثر القيد قبل الحذف
        const oldLines = query(`SELECT account_id, debit, credit FROM journal_entry_lines WHERE entry_id = ?`, [id]);
        oldLines.forEach(l => {
            if (l[1] > 0) window.updateAccountBalance(l[0], l[1], 'credit');
            if (l[2] > 0) window.updateAccountBalance(l[0], l[2], 'debit');
        });
        
        if (!confirm('هل تريد حذف القيد؟')) {
            db.run("ROLLBACK");
            return;
        }
        
        run(`UPDATE journal_entries SET status = 'Deleted' WHERE id = ?`, [id]);
       db.exec("COMMIT");
        saveDatabase();
        addLog('حذف قيد', id);
        alert('تم الحذف');
        
        const entryType = query(`SELECT entry_type FROM journal_entries WHERE id = ?`, [id])[0]?.[0];
        if (entryType === 'opening') openingEntriesList(); else dailyEntriesList();
    } catch (error) {
       try { db.exec("ROLLBACK"); } catch(e) {}
        alert('فشل حذف القيد: ' + error.message);
    }
}

function restoreEntry(id) {
    try {
      db.exec("BEGIN");
        
        // إعادة تطبيق أثر القيد
        const lines = query(`SELECT account_id, debit, credit FROM journal_entry_lines WHERE entry_id = ?`, [id]);
        lines.forEach(l => {
            if (l[1] > 0) window.updateAccountBalance(l[0], l[1], 'debit');
            if (l[2] > 0) window.updateAccountBalance(l[0], l[2], 'credit');
        });
        
        run(`UPDATE journal_entries SET status = 'Posted' WHERE id = ?`, [id]);
       db.exec("COMMIT");
        saveDatabase();
        alert('تم الاسترجاع');
        deletedEntriesPage();
    } catch (error) {
    try { db.exec("ROLLBACK"); } catch(e) {}
        alert('فشل استرجاع القيد: ' + error.message);
    }
}

// دوال مساعدة
function getCurrencyOptions(selectedId = null) {
    if (!selectedId) {
        const def = currencies.find(c => c.default);
        selectedId = def ? def.id : 1;
    }
    return currencies.map(c => 
        `<option value="${c.id}" ${c.id == selectedId ? 'selected' : ''}>${c.name}</option>`
    ).join('');
}

function getCurrencyName(id) {
    const c = currencies.find(c => c.id == id);
    return c ? c.symbol : '';
}

function formatMoney(amount) {
    return Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ================ دوال الصلاحيات ================
function canEditJournal() {
    return window.hasPermission ? window.hasPermission('edit_journal') : true;
}
function canDeleteJournal() {
    return window.hasPermission ? window.hasPermission('delete_journal') : true;
}

// ================ طباعة ================
function printEntry(id) {
    const entry = query(`SELECT entry_number, date, ref, currency_id, description, entry_type, amount_words FROM journal_entries WHERE id = ?`, [id])[0];
    if (!entry) return;
    const lines = query(`SELECT a.code, a.name, l.debit, l.credit FROM journal_entry_lines l JOIN chart_of_accounts a ON l.account_id = a.id WHERE l.entry_id = ?`, [id]);

    let rows = '';
    let td = 0, tc = 0;
    lines.forEach(l => {
        td += l[2] || 0; tc += l[3] || 0;
        rows += `<tr><td>${escapeHtml(l[0])} - ${escapeHtml(l[1])}</td><td>${formatMoney(l[2])}</td><td>${formatMoney(l[3])}</td></tr>`;
    });

    const w = window.open('', '_blank', 'width=800,height=600');
    w.document.write(`<html dir="rtl"><head><title>قيد - ${escapeHtml(entry[0])}</title><style>body{font-family:Tahoma;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #000;padding:8px}th{background:#eee}@media print{.no-print{display:none}}</style></head>
    <body><h3>${entry[5]==='opening'?'قيد افتتاحي':'قيد يومي'}</h3>
    <p><b>الرقم:</b> ${escapeHtml(entry[0])} | <b>التاريخ:</b> ${entry[1]} | <b>المرجع:</b> ${escapeHtml(entry[2]||'-')}</p>
    <p><b>البيان:</b> ${escapeHtml(entry[4]||'-')} | <b>المبلغ كتابة:</b> ${entry[6]||'-'}</p>
    <table><tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr>${rows}
    <tr style="font-weight:bold"><td>الإجمالي</td><td>${formatMoney(td)}</td><td>${formatMoney(tc)}</td></tr></table>
    <div class="no-print" style="margin-top:20px"><button onclick="window.print()">طباعة</button></div></body></html>`);
    w.document.close();
}

// تعريض الدوال
window.journalPage = journalPage;
window.openingEntriesPage = openingEntriesPage;
window.dailyEntriesPage = dailyEntriesPage;
window.deletedEntriesPage = deletedEntriesPage;
window.addOpeningEntryForm = addOpeningEntryForm;
window.addDailyEntryForm = addDailyEntryForm;
window.saveOpeningEntry = saveOpeningEntry;
window.saveDailyEntry = saveDailyEntry;
window.openingEntriesList = openingEntriesList;
window.dailyEntriesList = dailyEntriesList;
window.viewEntry = viewEntry;
window.editEntry = editEntry;
window.updateEntry = updateEntry;
window.deleteEntry = deleteEntry;
window.restoreEntry = restoreEntry;
window.searchOpeningEntries = searchOpeningEntries;
window.searchDailyEntries = searchDailyEntries;
window.addEntryLine = addEntryLine;
window.removeEntryLine = removeEntryLine;
window.updateEntryTotals = updateEntryTotals;
window.canEditJournal = canEditJournal;
window.canDeleteJournal = canDeleteJournal;
window.printEntry = printEntry;
