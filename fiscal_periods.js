// fiscal_periods.js - وحدة إدارة الفترات المالية وإقفالها
console.log('📅 تحميل وحدة الفترات المالية...');

// ======================== الصفحة الرئيسية للفترات المالية ========================
function fiscalPeriodsPage() {
    const periods = query(`
        SELECT id, name, start_date, end_date, status
        FROM fiscal_periods
        ORDER BY start_date DESC
    `);

    let rows = '';
    periods.forEach(p => {
        const id = p[0];
        const name = p[1];
        const start = p[2];
        const end = p[3];
        const status = p[4];
        const statusText = status === 'Open' ? '🟢 مفتوحة' : (status === 'Closed' ? '🔴 مغلقة' : '🔒 مقفلة');

        rows += `<tr>
            <td>${name}</td>
            <td>${start}</td>
            <td>${end}</td>
            <td>${statusText}</td>
            <td>
                ${status === 'Open' ? `<button onclick="closeFiscalPeriod(${id}, '${name}')">إقفال الفترة</button>` : ''}
                <button onclick="viewPeriodDetails(${id})">عرض</button>
            </td>
        </tr>`;
    });

    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-calendar-alt"></i> الفترات المالية</h2>
            <button onclick="addFiscalPeriodForm()"><i class="fas fa-plus"></i> إضافة فترة</button>
            <button onclick="dashboard()"><i class="fas fa-arrow-right"></i> رجوع</button>
        </div>
        <div class="card">
            <table>
                <tr><th>اسم الفترة</th><th>تاريخ البداية</th><th>تاريخ النهاية</th><th>الحالة</th><th>إجراءات</th></tr>
                ${rows || '<tr><td colspan="5">لا توجد فترات مالية</td></tr>'}
            </table>
        </div>
    `;
}

// ======================== إضافة فترة جديدة ========================
function addFiscalPeriodForm() {
    content.innerHTML = `
        <div class="card">
            <h2>إضافة فترة مالية جديدة</h2>
            <label>اسم الفترة (مثال: 2026)</label>
            <input id="periodName" placeholder="اسم الفترة">
            <label>تاريخ البداية</label>
            <input id="periodStart" type="date" value="${today()}">
            <label>تاريخ النهاية</label>
            <input id="periodEnd" type="date" value="${today()}">
            <br><br>
            <button onclick="saveFiscalPeriod()">حفظ</button>
            <button onclick="fiscalPeriodsPage()">إلغاء</button>
        </div>
    `;
}

function saveFiscalPeriod() {
    const name = document.getElementById('periodName').value.trim();
    const start = document.getElementById('periodStart').value;
    const end = document.getElementById('periodEnd').value;

    if (!name) { alert('أدخل اسم الفترة'); return; }
    if (!start || !end) { alert('اختر تاريخ البداية والنهاية'); return; }
    if (new Date(start) >= new Date(end)) { alert('تاريخ النهاية يجب أن يكون بعد تاريخ البداية'); return; }

    // التأكد من عدم تداخل الفترات
    const overlapping = query(`
        SELECT id FROM fiscal_periods
        WHERE (start_date <= ? AND end_date >= ?) OR (start_date <= ? AND end_date >= ?)
    `, [end, start, start, end]);
    if (overlapping.length > 0) { alert('هناك فترة مالية تتداخل مع التواريخ المحددة.'); return; }

    run(`INSERT INTO fiscal_periods (name, start_date, end_date, status) VALUES (?, ?, ?, 'Open')`,
        [name, start, end]);
    
    saveDatabase();
    addLog('إضافة فترة مالية', name);
    alert('تم إضافة الفترة المالية بنجاح');
    fiscalPeriodsPage();
}

// ======================== عرض تفاصيل فترة ========================
function viewPeriodDetails(id) {
    const period = query(`SELECT name, start_date, end_date, status FROM fiscal_periods WHERE id = ?`, [id])[0];
    if (!period) return;

    // حساب إجمالي الإيرادات والمصروفات لهذه الفترة
    const revenue = query(`
        SELECT SUM(l.credit) FROM journal_entry_lines l
        JOIN journal_entries e ON l.entry_id = e.id
        JOIN chart_of_accounts a ON l.account_id = a.id
        WHERE e.period_id = ? AND a.type = 'Revenue' AND e.status = 'Posted'
    `, [id])[0][0] || 0;

    const expenses = query(`
        SELECT SUM(l.debit) FROM journal_entry_lines l
        JOIN journal_entries e ON l.entry_id = e.id
        JOIN chart_of_accounts a ON l.account_id = a.id
        WHERE e.period_id = ? AND a.type = 'Expense' AND e.status = 'Posted'
    `, [id])[0][0] || 0;

    const netIncome = revenue - expenses;

    content.innerHTML = `
        <div class="card">
            <h2>تفاصيل الفترة: ${period[0]}</h2>
            <p><strong>من:</strong> ${period[1]} <strong>إلى:</strong> ${period[2]}</p>
            <p><strong>الحالة:</strong> ${period[3] === 'Open' ? '🟢 مفتوحة' : '🔴 مغلقة'}</p>
            <hr>
            <p><strong>إجمالي الإيرادات:</strong> ${formatMoney(revenue)}</p>
            <p><strong>إجمالي المصروفات:</strong> ${formatMoney(expenses)}</p>
            <p><strong>صافي الربح / الخسارة:</strong> ${formatMoney(netIncome)}</p>
            <br>
            <button onclick="fiscalPeriodsPage()">رجوع</button>
        </div>
    `;
}

// ======================== إقفال الفترة المالية ========================
function closeFiscalPeriod(periodId, periodName) {
    // حساب الإيرادات والمصروفات للفترة
    const revenue = query(`
        SELECT SUM(l.credit) FROM journal_entry_lines l
        JOIN journal_entries e ON l.entry_id = e.id
        JOIN chart_of_accounts a ON l.account_id = a.id
        WHERE e.period_id = ? AND a.type = 'Revenue' AND e.status = 'Posted'
    `, [periodId])[0][0] || 0;

    const expenses = query(`
        SELECT SUM(l.debit) FROM journal_entry_lines l
        JOIN journal_entries e ON l.entry_id = e.id
        JOIN chart_of_accounts a ON l.account_id = a.id
        WHERE e.period_id = ? AND a.type = 'Expense' AND e.status = 'Posted'
    `, [periodId])[0][0] || 0;

    const netIncome = revenue - expenses;

    if (!confirm(`إقفال الفترة "${periodName}"؟\nإجمالي الإيرادات: ${formatMoney(revenue)}\nإجمالي المصروفات: ${formatMoney(expenses)}\nصافي الربح: ${formatMoney(netIncome)}`)) return;

    const date = today();
    const entryNumber = 'CLOSE-' + periodName + '-' + date;

    // 1. إنشاء قيد الإقفال
    run(`INSERT INTO journal_entries (entry_number, date, description, period_id, status, auto_generated)
         VALUES (?, ?, ?, ?, 'Posted', 1)`,
        [entryNumber, date, `إقفال الفترة ${periodName}`, periodId]);
    const entryId = query(`SELECT last_insert_rowid()`)[0][0];

    // 2. إقفال الإيرادات (مدين كل حساب إيراد)
    const revenueAccounts = query(`
        SELECT a.id, SUM(l.credit) as total
        FROM journal_entry_lines l
        JOIN journal_entries e ON l.entry_id = e.id
        JOIN chart_of_accounts a ON l.account_id = a.id
        WHERE e.period_id = ? AND a.type = 'Revenue' AND e.status = 'Posted'
        GROUP BY a.id
    `, [periodId]);
    
    revenueAccounts.forEach(acc => {
        if (acc[1] > 0) {
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, acc[0], acc[1]]);
            window.updateAccountBalance(acc[0], acc[1], 'debit');
        }
    });

    // 3. إقفال المصروفات (دائن كل حساب مصروف)
    const expenseAccounts = query(`
        SELECT a.id, SUM(l.debit) as total
        FROM journal_entry_lines l
        JOIN journal_entries e ON l.entry_id = e.id
        JOIN chart_of_accounts a ON l.account_id = a.id
        WHERE e.period_id = ? AND a.type = 'Expense' AND e.status = 'Posted'
        GROUP BY a.id
    `, [periodId]);
    
    expenseAccounts.forEach(acc => {
        if (acc[1] > 0) {
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, acc[0], acc[1]]);
            window.updateAccountBalance(acc[0], acc[1], 'credit');
        }
    });

    // 4. تحويل صافي الدخل إلى الأرباح المحتجزة (3300)
    const retainedEarnings = query(`SELECT id FROM chart_of_accounts WHERE code = '3300'`)[0];
    const incomeSummary = 3400; // حساب ملخص الدخل (صافي الربح/الخسارة)

    if (retainedEarnings) {
        if (netIncome > 0) {
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, incomeSummary, netIncome]);
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, retainedEarnings[0], netIncome]);
            window.updateAccountBalance(incomeSummary, netIncome, 'debit');
            window.updateAccountBalance(retainedEarnings[0], netIncome, 'credit');
        } else if (netIncome < 0) {
            const loss = Math.abs(netIncome);
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, incomeSummary, loss]);
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, retainedEarnings[0], loss]);
            window.updateAccountBalance(incomeSummary, loss, 'credit');
            window.updateAccountBalance(retainedEarnings[0], loss, 'debit');
        }
    }

    // 5. تحديث حالة الفترة إلى مغلقة
    run(`UPDATE fiscal_periods SET status = 'Closed' WHERE id = ?`, [periodId]);

    saveDatabase();
    addLog('إقفال الفترة المالية', periodName);
    alert(`تم إقفال الفترة "${periodName}" بنجاح.`);
    fiscalPeriodsPage();
}

// تعريض الدوال
window.fiscalPeriodsPage = fiscalPeriodsPage;
window.addFiscalPeriodForm = addFiscalPeriodForm;
window.saveFiscalPeriod = saveFiscalPeriod;
window.viewPeriodDetails = viewPeriodDetails;
window.closeFiscalPeriod = closeFiscalPeriod;