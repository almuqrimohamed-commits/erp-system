// balance_rebuild.js
// SAFE Balance Rebuild - Voucher Aware

console.log("🛡️ Safe Balance Rebuild Loaded");

let balanceReport = [];

function runBalanceRebuild() {

    if (!window.db || typeof window.query !== "function") {
        alert("قاعدة البيانات غير جاهزة");
        return;
    }

    try {

        balanceReport = [];

        const accounts = window.query(`
            SELECT id, name, type, current_balance
            FROM chart_of_accounts
        `);

        for (const acc of accounts) {

            const accountId = acc[0];
            const name = acc[1];
            const type = acc[2];
            const stored = Number(acc[3]) || 0;

            // حساب الحركات الفعلية فقط
            const lines = window.query(`
                SELECT 
                    l.debit,
                    l.credit
                FROM journal_entry_lines l
                JOIN journal_entries j 
                    ON j.id = l.entry_id
                LEFT JOIN vouchers v
                    ON v.journal_entry_id = j.id
                WHERE 
                    l.account_id = ?
                    AND j.status = 'Posted'
                    AND (
                        v.id IS NULL
                        OR v.deleted = 0
                    )
            `, [accountId]);

            let calculated = 0;

            for (const l of lines) {

                const debit = Number(l[0]) || 0;
                const credit = Number(l[1]) || 0;

                let effect = 0;

                if (type === 'Asset' || type === 'Expense') {
                    effect = debit - credit;
                } else {
                    effect = credit - debit;
                }

                calculated += effect;
            }

            const diff = calculated - stored;

            if (Math.abs(diff) > 0.0001) {

                balanceReport.push({
                    id: accountId,
                    name,
                    type,
                    stored,
                    calculated,
                    diff
                });
            }
        }

        showBalanceReport();

    } catch (e) {

        console.error(e);
        alert("خطأ أثناء تحليل الأرصدة");

    }
}

function showBalanceReport() {

    let html = `
        <div class="card">
            <h2>🔍 تقرير تدقيق الأرصدة</h2>
    `;

    if (balanceReport.length === 0) {

        html += `
            <p style="color:green">
                ✔ جميع الأرصدة سليمة
            </p>
        `;

        html += `
            <button onclick="dashboard()">
                ↩ رجوع
            </button>
        `;

        html += `</div>`;

        content.innerHTML = html;

        return;
    }

    html += `
        <table>
            <tr>
                <th>الحساب</th>
                <th>المخزن</th>
                <th>المحسوب</th>
                <th>الفرق</th>
            </tr>
    `;

    for (const acc of balanceReport) {

        html += `
            <tr>
                <td>${acc.name}</td>

                <td>
                    ${acc.stored.toFixed(2)}
                </td>

                <td>
                    ${acc.calculated.toFixed(2)}
                </td>

                <td style="color:red">
                    ${acc.diff.toFixed(2)}
                </td>
            </tr>
        `;
    }

    html += `
        </table>

        <br>

        <button onclick="fixBalancesSafe()">
            🔧 إصلاح الأرصدة بأمان
        </button>

        <button onclick="dashboard()">
            ↩ رجوع
        </button>

        </div>
    `;

    content.innerHTML = html;
}

function fixBalancesSafe() {

    if (!confirm(
        "سيتم تحديث الأرصدة بدون المساس بحركات السندات. متابعة؟"
    )) return;

    try {

        for (const acc of balanceReport) {

            window.run(
                `
                UPDATE chart_of_accounts
                SET current_balance = ?
                WHERE id = ?
                `,
                [
                    acc.calculated,
                    acc.id
                ]
            );

        }

        window.saveDatabase();

        alert(
            "تم إصلاح الأرصدة بنجاح بدون التأثير على السندات"
        );

        runBalanceRebuild();

    } catch (e) {

        console.error(e);

        alert(
            "فشل الإصلاح"
        );

    }
}

window.runBalanceRebuild = runBalanceRebuild;
window.fixBalancesSafe = fixBalancesSafe;