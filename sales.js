// sales.js - وحدة إدارة المبيعات (نسخة SQLite متكاملة - معدلة بالكامل)
console.log('🛒 تحميل وحدة المبيعات...');

// ======================== دوال مساعدة ========================
function getProducts() {
    return query(`SELECT id, code, name, sales_price, current_stock, average_cost FROM items WHERE is_active = 1`);
}

function getCustomers() {
    return query(`SELECT id, code, name, account_id FROM partners WHERE type IN ('Customer','Both') AND deleted = 0`);
}

function getNextInvoiceNumber() {
    const result = query(`SELECT invoice_number FROM sales_invoices ORDER BY id DESC LIMIT 1`);
    if (!result.length) return 'INV-000001';
    const last = result[0][0];
    const num = parseInt(last.replace('INV-', '')) + 1;
    return 'INV-' + String(num).padStart(6, '0');
}

function getNextQuoteNumber() {
    const result = query(`SELECT quote_number FROM quotations ORDER BY id DESC LIMIT 1`);
    if (!result.length) return 'Q-000001';
    const last = result[0][0];
    const num = parseInt(last.replace('Q-', '')) + 1;
    return 'Q-' + String(num).padStart(6, '0');
}

function getNextReturnNumber() {
    const result = query(`SELECT return_number FROM sales_returns ORDER BY id DESC LIMIT 1`);
    if (!result.length) return 'SR-000001';
    const last = result[0][0];
    const num = parseInt(last.replace('SR-', '')) + 1;
    return 'SR-' + String(num).padStart(6, '0');
}

// ======================== دوال الصلاحيات ========================
function canEditSale() {
    return window.hasPermission ? window.hasPermission('edit_sales') : true;
}
function canDeleteSale() {
    return window.hasPermission ? window.hasPermission('delete_sales') : true;
}

// ======================== الصفحات الرئيسية ========================
function salesPage() {
    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-shopping-cart"></i> إدارة المبيعات</h2>
            <button onclick="salesInvoicePage()">📄 فواتير المبيعات</button>
            <button onclick="quotesPage()">📋 عروض الأسعار</button>
            <button onclick="salesReturnPage()">🔄 مرتجع المبيعات</button>
            <button onclick="dashboard()">↩️ رجوع</button>
        </div>
    `;
}

function salesInvoicePage() {
    content.innerHTML = `
        <div class="card">
            <h3>فواتير المبيعات</h3>
            <button onclick="newSalesInvoice()">➕ إضافة فاتورة</button>
            <button onclick="salesInvoicesList()">📋 عرض الفواتير</button>
            <button onclick="deletedSalesInvoices()">🗑️ الفواتير المحذوفة</button>
            <button onclick="salesPage()">↩️ رجوع</button>
        </div>
    `;
}

function salesReturnPage() {
    content.innerHTML = `
        <div class="card">
            <h3>مرتجع المبيعات</h3>
            <button onclick="newSalesReturn()">➕ إضافة مرتجع</button>
            <button onclick="salesReturnsList()">📋 عرض المرتجعات</button>
            <button onclick="deletedSalesReturns()">🗑️ المرتجعات المحذوفة</button>
            <button onclick="salesPage()">↩️ رجوع</button>
        </div>
    `;
}

// ======================== نموذج فاتورة مبيعات ========================
let currentInvoice = { type: 'cash', customerId: null, currency: 'YER', ref: '', items: [] };

function newSalesInvoice() {
    currentInvoice = { type: 'cash', customerId: null, currency: 'YER', ref: '', items: [] };
    renderInvoiceForm();
}

function renderInvoiceForm() {
    const customers = getCustomers();
    let customerOptions = `<option value="">نقدي</option>`;
    customers.forEach(c => {
        customerOptions += `<option value="${c[0]}" ${currentInvoice.customerId == c[0] ? 'selected' : ''}>${escapeHtml(c[2])}</option>`;
    });

    const products = getProducts();
    let productOptions = '';
    products.forEach(p => {
        productOptions += `<option value="${p[0]}" data-price="${p[3]}" data-avg="${p[5] || 0}">${escapeHtml(p[2])} (${p[4]})</option>`;
    });

    let rows = '';
    currentInvoice.items.forEach((item, i) => {
        rows += `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td><input type="number" value="${item.qty}" id="sqty_${i}" oninput="updateSaleItem(${i}, 'qty', this.value)" style="width:80px;"></td>
            <td><input type="number" value="${item.price}" id="sprice_${i}" oninput="updateSaleItem(${i}, 'price', this.value)" style="width:100px;"></td>
            <td id="stotal_${i}">${(item.qty * item.price).toFixed(2)}</td>
            <td><button onclick="removeSaleItem(${i})">حذف</button></td>
        </tr>`;
    });

    content.innerHTML = `
        <div class="card">
            <h2>${window.editingInvoiceId ? 'تعديل فاتورة مبيعات' : 'فاتورة مبيعات'}</h2>
            <table>
                <tr><td>رقم</td><td>${window.editingInvoiceId ? (query(`SELECT invoice_number FROM sales_invoices WHERE id=?`, [window.editingInvoiceId])[0]?.[0] || '') : getNextInvoiceNumber()}</td><td>تاريخ</td><td>${today()}</td></tr>
                <tr>
                    <td>نوع</td>
                    <td>
                        <select onchange="currentInvoice.type = this.value; renderInvoiceForm()">
                            <option value="cash" ${currentInvoice.type == 'cash' ? 'selected' : ''}>نقد</option>
                            <option value="credit" ${currentInvoice.type == 'credit' ? 'selected' : ''}>آجل</option>
                        </select>
                    </td>
                    <td>عميل</td>
                    <td><select onchange="currentInvoice.customerId = this.value || null">${customerOptions}</select></td>
                </tr>
                <tr>
                    <td>عملة</td>
                    <td>
                        <select onchange="currentInvoice.currency = this.value">
                            <option value="YER" ${currentInvoice.currency == 'YER' ? 'selected' : ''}>ريال يمني</option>
                            <option value="SAR" ${currentInvoice.currency == 'SAR' ? 'selected' : ''}>ريال سعودي</option>
                            <option value="USD" ${currentInvoice.currency == 'USD' ? 'selected' : ''}>دولار</option>
                        </select>
                    </td>
                    <td>مرجع</td>
                    <td><input value="${escapeHtml(currentInvoice.ref)}" oninput="currentInvoice.ref = this.value"></td>
                </tr>
            </table>
        </div>
        <div class="card">
            <select id="saleProduct">${productOptions}</select>
            <input id="saleQty" type="number" placeholder="الكمية" value="1">
            <button onclick="addSaleItem()">إضافة</button>
        </div>
        <div class="card">
            <table>
                <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr>
                ${rows}
            </table>
            <h3>الإجمالي: <span id="saleGrandTotal">${invoiceTotal().toFixed(2)}</span></h3>
            <button onclick="saveInvoice()">${window.editingInvoiceId ? 'تحديث' : 'حفظ'}</button>
            <button onclick="salesInvoicePage()">إلغاء</button>
        </div>
    `;
}

function addSaleItem() {
    const select = document.getElementById('saleProduct');
    const selected = select.options[select.selectedIndex];
    const productId = parseInt(select.value);
    const productName = selected.text.split(' (')[0];
    const price = parseFloat(selected.dataset.price);
    const qty = parseFloat(document.getElementById('saleQty').value) || 0;
    if (qty <= 0) { alert('أدخل الكمية'); return; }
    const stock = query(`SELECT current_stock FROM items WHERE id = ?`, [productId])[0][0] || 0;
    if (qty > stock) { alert(`المخزون غير كافٍ (المتوفر: ${stock})`); return; }

    currentInvoice.items.push({ productId, name: productName, price, qty });
    const table = document.querySelector('table');
    if (table) {
        const index = currentInvoice.items.length - 1;
        const newRow = table.insertRow(-1);
        newRow.innerHTML = `
            <td>${escapeHtml(productName)}</td>
            <td><input type="number" value="${qty}" id="sqty_${index}" oninput="updateSaleItem(${index}, 'qty', this.value)" style="width:80px;"></td>
            <td><input type="number" value="${price}" id="sprice_${index}" oninput="updateSaleItem(${index}, 'price', this.value)" style="width:100px;"></td>
            <td id="stotal_${index}">${(qty * price).toFixed(2)}</td>
            <td><button onclick="removeSaleItem(${index})">حذف</button></td>
        `;
        document.getElementById('saleQty').value = '1';
        const grandTotal = document.getElementById('saleGrandTotal');
        if (grandTotal) grandTotal.innerText = invoiceTotal().toFixed(2);
    } else {
        renderInvoiceForm();
    }
}

function updateSaleItem(index, field, value) {
    const val = parseFloat(value) || 0;
    if (field === 'qty') {
        currentInvoice.items[index].qty = val;
    } else if (field === 'price') {
        currentInvoice.items[index].price = val;
    }
    const totalCell = document.getElementById(`stotal_${index}`);
    if (totalCell) {
        totalCell.innerText = (currentInvoice.items[index].qty * currentInvoice.items[index].price).toFixed(2);
    }
    const grandTotal = document.getElementById('saleGrandTotal');
    if (grandTotal) {
        grandTotal.innerText = invoiceTotal().toFixed(2);
    }
}

function removeSaleItem(i) {
    currentInvoice.items.splice(i, 1);
    renderInvoiceForm();
}

function invoiceTotal() {
    return currentInvoice.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
}

function saveInvoice() {
    if (currentInvoice.items.length === 0) { alert('الفاتورة فارغة'); return; }
    if (currentInvoice.type === 'credit' && !currentInvoice.customerId) { alert('اختر عميل للبيع الآجل'); return; }

    if (window.editingInvoiceId) {
        updateInvoice(window.editingInvoiceId);
        return;
    }

    const period = query(`SELECT id FROM fiscal_periods WHERE status = 'Open' LIMIT 1`);
    if (!period.length) { alert('لا توجد فترة مالية مفتوحة.'); return; }
    const periodId = period[0][0];

    const total = invoiceTotal();
    const invoiceNumber = getNextInvoiceNumber();
    const date = today();

    run('BEGIN TRANSACTION');
    try {
        run(`INSERT INTO sales_invoices (invoice_number, date, customer_id, total, status, currency, ref, type)
             VALUES (?, ?, ?, ?, 'Posted', ?, ?, ?)`,
            [invoiceNumber, date, currentInvoice.customerId, total, currentInvoice.currency, currentInvoice.ref, currentInvoice.type]);
        
        const idResult = query(`SELECT id FROM sales_invoices WHERE invoice_number = ?`, [invoiceNumber]);
        if (!idResult.length) throw new Error('فشل استرداد رقم الفاتورة');
        const invoiceId = idResult[0][0];

        let costOfGoodsSold = 0;
        for (const item of currentInvoice.items) {
            const lineTotal = item.qty * item.price;
            run(`INSERT INTO sales_invoice_lines (invoice_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)`,
                [invoiceId, item.productId, item.qty, item.price, lineTotal]);
            run(`UPDATE items SET current_stock = current_stock - ? WHERE id = ?`, [item.qty, item.productId]);
            
            const costRow = query(`SELECT average_cost, purchase_cost FROM items WHERE id = ?`, [item.productId]);
            let cost = 0;
            if (costRow.length) {
                cost = costRow[0][0] || costRow[0][1] || 0;
            }
            costOfGoodsSold += cost * item.qty;
        }

        const cashAccount = 11101;
        const salesAccountCash = 4110;
        const salesAccountCredit = 4120;
        const cogsAccount = 5100;
        const inventoryAccount = 11701;

        let customerAccount = null;
        if (currentInvoice.type === 'credit') {
            const custRow = query(`SELECT account_id FROM partners WHERE id = ?`, [currentInvoice.customerId]);
            if (!custRow.length || !custRow[0][0]) throw new Error('العميل ليس له حساب مرتبط');
            customerAccount = custRow[0][0];
        }

        const entryNumber = 'JV-' + invoiceNumber;
        run(`INSERT INTO journal_entries (entry_number, date, description, period_id, status, auto_generated)
             VALUES (?, ?, ?, ?, 'Posted', 1)`,
            [entryNumber, date, `فاتورة مبيعات ${invoiceNumber}`, periodId]);
        const entryIdResult = query(`SELECT id FROM journal_entries WHERE entry_number = ?`, [entryNumber]);
        const entryId = entryIdResult[0][0];

        if (currentInvoice.type === 'cash') {
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, cashAccount, total]);
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, salesAccountCash, total]);
            window.updateAccountBalance(cashAccount, total, 'debit');
            window.updateAccountBalance(salesAccountCash, total, 'credit');
        } else {
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, customerAccount, total]);
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, salesAccountCredit, total]);
            window.updateAccountBalance(customerAccount, total, 'debit');
            window.updateAccountBalance(salesAccountCredit, total, 'credit');
        }

        if (costOfGoodsSold > 0) {
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, cogsAccount, costOfGoodsSold]);
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, inventoryAccount, costOfGoodsSold]);
            window.updateAccountBalance(cogsAccount, costOfGoodsSold, 'debit');
            window.updateAccountBalance(inventoryAccount, costOfGoodsSold, 'credit');
        }

        run(`UPDATE sales_invoices SET journal_entry_id = ? WHERE id = ?`, [entryId, invoiceId]);
        run('COMMIT');
        saveDatabase();
        addLog('إضافة فاتورة مبيعات', invoiceNumber);
        alert('تم حفظ الفاتورة والقيد المحاسبي');
        salesInvoicesList();
    } catch (error) {
        run('ROLLBACK');
        alert('فشل حفظ الفاتورة: ' + error.message);
        console.error(error);
    }
}

// ======================== عرض الفواتير ========================
function salesInvoicesList() {
    const invoices = query(`
        SELECT s.id, s.invoice_number, s.date, p.name, s.type, s.total
        FROM sales_invoices s
        LEFT JOIN partners p ON s.customer_id = p.id
        WHERE s.status != 'Deleted'
        ORDER BY s.date DESC, s.id DESC
    `);

    let rows = '';
    invoices.forEach(inv => {
        rows += `<tr>
            <td>${escapeHtml(inv[1])}</td><td>${inv[2]}</td><td>${escapeHtml(inv[3] || 'نقدي')}</td><td>${inv[4] || 'نقد'}</td><td>${inv[5].toFixed(2)}</td>
            <td>
                <button onclick="viewInvoice(${inv[0]})">عرض</button>
                ${canEditSale() ? `<button onclick="editInvoice(${inv[0]})">تعديل</button>` : ''}
                ${canDeleteSale() ? `<button onclick="deleteInvoice(${inv[0]})">حذف</button>` : ''}
            </td>
        </tr>`;
    });

    content.innerHTML = `
        <div class="card">
            <h3>فواتير المبيعات</h3>
            <input id="searchInvoice" placeholder="بحث..." onkeyup="searchInvoice()">
        </div>
        <div class="card">
            <table>
                <tr><th>رقم</th><th>التاريخ</th><th>العميل</th><th>النوع</th><th>الإجمالي</th><th>العمليات</th></tr>
                ${rows || '<tr><td colspan="6">لا توجد فواتير</td></tr>'}
            </table>
            <button onclick="salesInvoicePage()">رجوع</button>
        </div>
    `;
}

function searchInvoice() {
    const q = document.getElementById('searchInvoice').value.toLowerCase();
    const invoices = query(`
        SELECT s.id, s.invoice_number, s.date, p.name, s.type, s.total
        FROM sales_invoices s
        LEFT JOIN partners p ON s.customer_id = p.id
        WHERE s.status != 'Deleted' AND (LOWER(s.invoice_number) LIKE ? OR LOWER(p.name) LIKE ?)
        ORDER BY s.date DESC
    `, [`%${q}%`, `%${q}%`]);

    let rows = '';
    invoices.forEach(inv => {
        rows += `<tr>
            <td>${escapeHtml(inv[1])}</td><td>${inv[2]}</td><td>${escapeHtml(inv[3] || 'نقدي')}</td><td>${inv[4] || 'نقد'}</td><td>${inv[5].toFixed(2)}</td>
            <td>
                <button onclick="viewInvoice(${inv[0]})">عرض</button>
                ${canEditSale() ? `<button onclick="editInvoice(${inv[0]})">تعديل</button>` : ''}
                ${canDeleteSale() ? `<button onclick="deleteInvoice(${inv[0]})">حذف</button>` : ''}
            </td>
        </tr>`;
    });

    document.querySelector('table').innerHTML = `
        <tr><th>رقم</th><th>التاريخ</th><th>العميل</th><th>النوع</th><th>الإجمالي</th><th>العمليات</th></tr>
        ${rows}
    `;
}

function viewInvoice(id) {
    window.previewDocument('sales', id);
}

function editInvoice(id) {
    const inv = query(`SELECT * FROM sales_invoices WHERE id = ?`, [id])[0];
    if (!inv) return;

    const lines = query(`SELECT item_id, quantity, unit_price FROM sales_invoice_lines WHERE invoice_id = ?`, [id]);
    
    currentInvoice = {
        type: inv[7],
        customerId: inv[3],
        currency: inv[5],
        ref: inv[6] || '',
        items: lines.map(l => ({
            productId: l[0],
            name: query(`SELECT name FROM items WHERE id = ?`, [l[0]])[0][0],
            price: l[2],
            qty: l[1]
        }))
    };

    window.editingInvoiceId = id;
    renderInvoiceForm();
}

function updateInvoice(id) {
    const oldInv = query(`SELECT invoice_number, type, total, customer_id FROM sales_invoices WHERE id = ?`, [id])[0];
    if (!oldInv) return;

    const oldLines = query(`SELECT item_id, quantity FROM sales_invoice_lines WHERE invoice_id = ?`, [id]);

    // 1. إرجاع المخزون القديم
    oldLines.forEach(line => {
        run(`UPDATE items SET current_stock = current_stock + ? WHERE id = ?`, [line[1], line[0]]);
    });

    // 2. عكس القيد القديم
    const oldEntryId = query(`SELECT journal_entry_id FROM sales_invoices WHERE id = ?`, [id])[0]?.[0];
    if (oldEntryId) {
        run(`DELETE FROM journal_entry_lines WHERE entry_id = ?`, [oldEntryId]);
        run(`DELETE FROM journal_entries WHERE id = ?`, [oldEntryId]);
    }

    // 3. حذف بنود الفاتورة القديمة
    run(`DELETE FROM sales_invoice_lines WHERE invoice_id = ?`, [id]);

    // 4. إعادة إدراج البنود الجديدة وخصم المخزون
    const total = invoiceTotal();
    run(`UPDATE sales_invoices SET type = ?, customer_id = ?, currency = ?, ref = ?, total = ? WHERE id = ?`,
        [currentInvoice.type, currentInvoice.customerId, currentInvoice.currency, currentInvoice.ref, total, id]);

    for (const item of currentInvoice.items) {
        const lineTotal = item.qty * item.price;
        run(`INSERT INTO sales_invoice_lines (invoice_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)`,
            [id, item.productId, item.qty, item.price, lineTotal]);
        run(`UPDATE items SET current_stock = current_stock - ? WHERE id = ?`, [item.qty, item.productId]);
    }

    // 5. إنشاء قيد جديد
    const entryNumber = 'JV-UPD-' + oldInv[0];
    const periodId = query(`SELECT id FROM fiscal_periods WHERE status = 'Open' LIMIT 1`)[0]?.[0] || 1;
    run(`INSERT INTO journal_entries (entry_number, date, description, period_id, status, auto_generated)
         VALUES (?, date('now'), ?, ?, 'Posted', 1)`,
        [entryNumber, `تعديل فاتورة مبيعات ${oldInv[0]}`, periodId]);
    const entryId = query(`SELECT id FROM journal_entries WHERE entry_number = ?`, [entryNumber])[0][0];

    const cashAccount = 11101;
    const salesAccountCash = 4110;
    const salesAccountCredit = 4120;
    const cogsAccount = 5100;
    const inventoryAccount = 11701;

    if (currentInvoice.type === 'cash') {
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, cashAccount, total]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, salesAccountCash, total]);
        window.updateAccountBalance(cashAccount, total, 'debit');
        window.updateAccountBalance(salesAccountCash, total, 'credit');
    } else {
        const custRow = query(`SELECT account_id FROM partners WHERE id = ?`, [currentInvoice.customerId]);
        if (!custRow.length || !custRow[0][0]) { alert('العميل ليس له حساب'); return; }
        const customerAccount = custRow[0][0];
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, customerAccount, total]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, salesAccountCredit, total]);
        window.updateAccountBalance(customerAccount, total, 'debit');
        window.updateAccountBalance(salesAccountCredit, total, 'credit');
    }

    let costOfGoodsSold = 0;
    for (const item of currentInvoice.items) {
        const costRow = query(`SELECT average_cost, purchase_cost FROM items WHERE id = ?`, [item.productId]);
        let cost = 0;
        if (costRow.length) {
            cost = costRow[0][0] || costRow[0][1] || 0;
        }
        costOfGoodsSold += cost * item.qty;
    }
    if (costOfGoodsSold > 0) {
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, cogsAccount, costOfGoodsSold]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, inventoryAccount, costOfGoodsSold]);
        window.updateAccountBalance(cogsAccount, costOfGoodsSold, 'debit');
        window.updateAccountBalance(inventoryAccount, costOfGoodsSold, 'credit');
    }

    run(`UPDATE sales_invoices SET journal_entry_id = ? WHERE id = ?`, [entryId, id]);
    saveDatabase();
    window.editingInvoiceId = null;
    alert('تم تحديث الفاتورة والمخزون والقيد');
    salesInvoicesList();
}

function deleteInvoice(id) {
    const inv = query(`SELECT invoice_number, customer_id, type, total, journal_entry_id FROM sales_invoices WHERE id = ?`, [id])[0];
    if (!inv) return;
    if (!confirm(`حذف الفاتورة ${inv[0]}؟ سيتم إرجاع المخزون وعكس القيد المحاسبي.`)) return;

    const invoiceNumber = inv[0];
    const customerId = inv[1];
    const type = inv[2];
    const total = inv[3];
    const oldEntryId = inv[4];

    const lines = query(`SELECT item_id, quantity FROM sales_invoice_lines WHERE invoice_id = ?`, [id]);
    lines.forEach(line => {
        run(`UPDATE items SET current_stock = current_stock + ? WHERE id = ?`, [line[1], line[0]]);
    });

    const periodId = query(`SELECT id FROM fiscal_periods WHERE status = 'Open' LIMIT 1`)[0]?.[0];
    const revEntryNumber = 'REV-SALE-' + invoiceNumber;
    run(`INSERT INTO journal_entries (entry_number, date, description, period_id, status, auto_generated)
         VALUES (?, date('now'), ?, ?, 'Posted', 1)`,
        [revEntryNumber, `إلغاء فاتورة مبيعات ${invoiceNumber}`, periodId]);
    const revEntryId = query(`SELECT id FROM journal_entries WHERE entry_number = ?`, [revEntryNumber])[0][0];

    const cashAccount = 11101;
    const salesAccountCash = 4110;
    const salesAccountCredit = 4120;
    const inventoryAccount = 11701;
    const cogsAccount = 5100;

    if (type === 'cash') {
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [revEntryId, cashAccount, total]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [revEntryId, salesAccountCash, total]);
        window.updateAccountBalance(cashAccount, total, 'credit');
        window.updateAccountBalance(salesAccountCash, total, 'debit');
    } else {
        const custRow = query(`SELECT account_id FROM partners WHERE id = ?`, [customerId]);
        if (!custRow.length) throw new Error('العميل ليس له حساب');
        const customerAccount = custRow[0][0];
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [revEntryId, customerAccount, total]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [revEntryId, salesAccountCredit, total]);
        window.updateAccountBalance(customerAccount, total, 'credit');
        window.updateAccountBalance(salesAccountCredit, total, 'debit');
    }

    let costOfGoodsSold = 0;
    lines.forEach(line => {
        const costRow = query(`SELECT average_cost, purchase_cost FROM items WHERE id = ?`, [line[0]]);
        const cost = costRow.length ? (costRow[0][0] || costRow[0][1] || 0) : 0;
        costOfGoodsSold += cost * line[1];
    });
    if (costOfGoodsSold > 0) {
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [revEntryId, cogsAccount, costOfGoodsSold]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [revEntryId, inventoryAccount, costOfGoodsSold]);
        window.updateAccountBalance(cogsAccount, costOfGoodsSold, 'credit');
        window.updateAccountBalance(inventoryAccount, costOfGoodsSold, 'debit');
    }

    run(`UPDATE sales_invoices SET status = 'Deleted', journal_entry_id = ? WHERE id = ?`, [revEntryId, id]);
    if (oldEntryId) run(`UPDATE journal_entries SET status = 'Reversed' WHERE id = ?`, [oldEntryId]);

    saveDatabase();
    addLog('حذف فاتورة مبيعات', invoiceNumber);
    alert('تم حذف الفاتورة وإرجاع المخزون وعكس القيد');
    salesInvoicesList();
}

function deletedSalesInvoices() {
    const invoices = query(`SELECT id, invoice_number, date, total FROM sales_invoices WHERE status = 'Deleted'`);
    let rows = '';
    invoices.forEach(inv => rows += `<tr><td>${escapeHtml(inv[1])}</td><td>${inv[2]}</td><td>${inv[3].toFixed(2)}</td>
        <td>${canDeleteSale() ? `<button onclick="restoreInvoice(${inv[0]})">استعادة</button>` : ''}</td></tr>`);
    content.innerHTML = `
        <div class="card"><h3>الفواتير المحذوفة</h3></div>
        <div class="card">
            <table>
                <tr><th>رقم</th><th>التاريخ</th><th>الإجمالي</th><th></th></tr>
                ${rows || '<tr><td colspan="4">لا يوجد</td></tr>'}
            </table>
            <button onclick="salesInvoicesList()">رجوع</button>
        </div>
    `;
}

function restoreInvoice(id) {
    run('BEGIN TRANSACTION');
    try {
        const lines = query(`SELECT item_id, quantity FROM sales_invoice_lines WHERE invoice_id = ?`, [id]);
        lines.forEach(line => {
            run(`UPDATE items SET current_stock = current_stock - ? WHERE id = ?`, [line[1], line[0]]);
        });
        run(`UPDATE sales_invoices SET status = 'Posted' WHERE id = ?`, [id]);
        run('COMMIT');
        saveDatabase();
        deletedSalesInvoices();
    } catch (e) {
        run('ROLLBACK');
        alert('فشل الاستعادة: ' + e.message);
    }
}

// ======================== عروض الأسعار ========================
function quotesPage() {
    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-file-invoice"></i> عروض الأسعار</h2>
            <button onclick="newQuote()"><i class="fas fa-plus"></i> إضافة عرض سعر</button>
            <button onclick="quotesList()"><i class="fas fa-list"></i> قائمة العروض</button>
            <button onclick="salesPage()"><i class="fas fa-arrow-right"></i> رجوع</button>
        </div>
    `;
}

let currentQuote = { customerId: null, ref: '', items: [] };

function newQuote() {
    currentQuote = { customerId: null, ref: '', items: [] };
    renderQuoteForm();
}

function renderQuoteForm() {
    const customers = getCustomers();
    let customerOptions = `<option value="">اختر العميل</option>`;
    customers.forEach(c => {
        customerOptions += `<option value="${c[0]}" ${currentQuote.customerId == c[0] ? 'selected' : ''}>${escapeHtml(c[2])}</option>`;
    });

    const products = getProducts();
    let productOptions = '';
    products.forEach(p => {
        productOptions += `<option value="${p[0]}" data-price="${p[3]}">${escapeHtml(p[2])}</option>`;
    });

    let rows = '';
    currentQuote.items.forEach((item, i) => {
        rows += `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td><input type="number" value="${item.qty}" onchange="currentQuote.items[${i}].qty = parseFloat(this.value) || 0; renderQuoteForm()"></td>
            <td><input type="number" value="${item.price}" onchange="currentQuote.items[${i}].price = parseFloat(this.value) || 0; renderQuoteForm()"></td>
            <td>${(item.qty * item.price).toFixed(2)}</td>
            <td><button onclick="currentQuote.items.splice(${i}, 1); renderQuoteForm()">حذف</button></td>
        </tr>`;
    });

    content.innerHTML = `
        <div class="card">
            <h2>عرض سعر جديد</h2>
            <table>
                <tr><td>رقم</td><td>${getNextQuoteNumber()}</td><td>تاريخ</td><td>${today()}</td></tr>
                <tr>
                    <td>العميل</td>
                    <td><select onchange="currentQuote.customerId = this.value || null">${customerOptions}</select></td>
                    <td>مرجع</td>
                    <td><input value="${escapeHtml(currentQuote.ref)}" oninput="currentQuote.ref = this.value"></td>
                </tr>
            </table>
        </div>
        <div class="card">
            <select id="quoteProduct">${productOptions}</select>
            <input id="quoteQty" type="number" placeholder="الكمية" value="1">
            <button onclick="addQuoteItem()">إضافة</button>
        </div>
        <div class="card">
            <table>
                <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr>
                ${rows}
            </table>
            <h3>الإجمالي: ${currentQuote.items.reduce((s,i) => s + i.qty * i.price, 0).toFixed(2)}</h3>
            <button onclick="saveQuote()">حفظ</button>
            <button onclick="quotesPage()">إلغاء</button>
        </div>
    `;
}

function addQuoteItem() {
    const select = document.getElementById('quoteProduct');
    const selected = select.options[select.selectedIndex];
    const productId = parseInt(select.value);
    const productName = selected.text;
    const price = parseFloat(selected.dataset.price);
    const qty = parseFloat(document.getElementById('quoteQty').value) || 1;
    if (qty <= 0) { alert('أدخل الكمية'); return; }
    currentQuote.items.push({ productId, name: productName, price, qty });
    renderQuoteForm();
}

function saveQuote() {
    if (!currentQuote.customerId) { alert('اختر العميل'); return; }
    if (currentQuote.items.length === 0) { alert('أضف صنفاً واحداً على الأقل'); return; }
    const total = currentQuote.items.reduce((s,i) => s + i.qty * i.price, 0);
    const quoteNumber = getNextQuoteNumber();
    const date = today();
    run(`INSERT INTO quotations (quote_number, date, customer_id, ref, total) VALUES (?, ?, ?, ?, ?)`,
        [quoteNumber, date, currentQuote.customerId, currentQuote.ref, total]);
    const quoteId = query(`SELECT id FROM quotations WHERE quote_number = ?`, [quoteNumber])[0][0];
    currentQuote.items.forEach(item => {
        run(`INSERT INTO quotation_lines (quote_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)`,
            [quoteId, item.productId, item.qty, item.price, item.qty * item.price]);
    });
    saveDatabase();
    addLog('إضافة عرض سعر', quoteNumber);
    alert('تم حفظ العرض');
    quotesList();
}

function quotesList() {
    const quotes = query(`
        SELECT q.id, q.quote_number, q.date, p.name, q.total, q.converted
        FROM quotations q
        LEFT JOIN partners p ON q.customer_id = p.id
        ORDER BY q.date DESC
    `);
    let rows = '';
    quotes.forEach(q => {
        rows += `<tr>
            <td>${escapeHtml(q[1])}</td>
            <td>${q[2]}</td>
            <td>${escapeHtml(q[3] || '-')}</td>
            <td>${q[4].toFixed(2)}</td>
            <td>${q[5] ? '✅ تم التحويل' : '⏳ قيد الانتظار'}</td>
            <td>
                <button onclick="viewQuote(${q[0]})">عرض</button>
                ${!q[5] ? `<button onclick="convertQuoteToInvoice(${q[0]})">تحويل لفاتورة</button>` : ''}
                <button onclick="deleteQuote(${q[0]})">حذف</button>
            </td>
        </tr>`;
    });
    content.innerHTML = `
        <div class="card">
            <h3>قائمة عروض الأسعار</h3>
            <button onclick="quotesPage()">رجوع</button>
        </div>
        <div class="card">
            <table>
                <tr><th>الرقم</th><th>التاريخ</th><th>العميل</th><th>الإجمالي</th><th>الحالة</th><th>إجراءات</th></tr>
                ${rows || '<tr><td colspan="6">لا توجد عروض</td></tr>'}
            </table>
        </div>
    `;
}

function viewQuote(id) {
    const q = query(`
        SELECT q.quote_number, q.date, p.name, q.total, q.ref
        FROM quotations q
        LEFT JOIN partners p ON q.customer_id = p.id
        WHERE q.id = ?
    `, [id])[0];
    if (!q) return;
    const lines = query(`
        SELECT i.name, l.quantity, l.unit_price, l.line_total
        FROM quotation_lines l
        JOIN items i ON l.item_id = i.id
        WHERE l.quote_id = ?
    `, [id]);
    let rows = '';
    lines.forEach(l => {
        rows += `<tr><td>${escapeHtml(l[0])}</td><td>${l[1]}</td><td>${formatMoney(l[2])}</td><td>${formatMoney(l[3])}</td></tr>`;
    });
    content.innerHTML = `
        <div class="card">
            <h2>عرض سعر ${escapeHtml(q[0])}</h2>
            <p><strong>التاريخ:</strong> ${q[1]}</p>
            <p><strong>العميل:</strong> ${escapeHtml(q[2] || '-')}</p>
            <p><strong>المرجع:</strong> ${escapeHtml(q[4] || '-')}</p>
            <p><strong>الإجمالي:</strong> ${formatMoney(q[3])}</p>
        </div>
        <div class="card">
            <table>
                <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
                ${rows}
            </table>
            <button onclick="quotesList()">رجوع</button>
        </div>
    `;
}

function deleteQuote(id) {
    if (!confirm('هل تريد حذف عرض السعر؟')) return;
    run(`DELETE FROM quotation_lines WHERE quote_id = ?`, [id]);
    run(`DELETE FROM quotations WHERE id = ?`, [id]);
    saveDatabase();
    addLog('حذف عرض سعر', id);
    quotesList();
}

function convertQuoteToInvoice(quoteId) {
    const q = query(`SELECT customer_id, ref FROM quotations WHERE id = ?`, [quoteId])[0];
    if (!q) return;
    const lines = query(`SELECT item_id, quantity, unit_price FROM quotation_lines WHERE quote_id = ?`, [quoteId]);
    if (!lines.length) { alert('العرض فارغ'); return; }
    const type = confirm('هل البيع آجل؟') ? 'credit' : 'cash';
    currentInvoice = { type: type, customerId: q[0], currency: 'YER', ref: q[1] || '', items: [] };
    lines.forEach(l => {
        const prod = query(`SELECT name FROM items WHERE id = ?`, [l[0]])[0];
        currentInvoice.items.push({ productId: l[0], name: prod[0], price: l[2], qty: l[1] });
    });
    saveInvoice();
    run(`UPDATE quotations SET converted = 1 WHERE id = ?`, [quoteId]);
    saveDatabase();
    addLog('تحويل عرض سعر إلى فاتورة', quoteId);
}

// ======================== مرتجعات المبيعات ========================
let currentSalesReturn = { type: 'cash', customerId: null, ref: '', items: [] };

function newSalesReturn() {
    currentSalesReturn = { type: 'cash', customerId: null, ref: '', items: [] };
    renderSalesReturnForm();
}

function renderSalesReturnForm() {
    const customers = getCustomers();
    let customerOptions = '<option value="">اختر العميل</option>';
    customers.forEach(c => {
        customerOptions += `<option value="${c[0]}" ${currentSalesReturn.customerId == c[0] ? 'selected' : ''}>${escapeHtml(c[2])}</option>`;
    });

    const products = getProducts();
    let productOptions = '';
    products.forEach(p => {
        productOptions += `<option value="${p[0]}" data-price="${p[3]}">${escapeHtml(p[2])} (${p[4]})</option>`;
    });

    let rows = '';
    currentSalesReturn.items.forEach((item, i) => {
        rows += `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td><input type="number" value="${item.qty}" onchange="changeReturnQty(${i}, this.value)"></td>
            <td><input type="number" value="${item.price}" onchange="changeReturnPrice(${i}, this.value)"></td>
            <td>${(item.qty * item.price).toFixed(2)}</td>
            <td><button onclick="removeReturnItem(${i})">حذف</button></td>
        </tr>`;
    });

    content.innerHTML = `
        <div class="card">
            <h2>مرتجع مبيعات</h2>
            <table>
                <tr><td>رقم</td><td>${getNextReturnNumber()}</td><td>تاريخ</td><td>${today()}</td></tr>
                <tr>
                    <td>نوع المرتجع</td>
                    <td>
                        <select onchange="currentSalesReturn.type = this.value; renderSalesReturnForm()">
                            <option value="cash" ${currentSalesReturn.type == 'cash' ? 'selected' : ''}>نقدي</option>
                            <option value="credit" ${currentSalesReturn.type == 'credit' ? 'selected' : ''}>آجل</option>
                        </select>
                    </td>
                    <td>العميل</td>
                    <td>
                        <select onchange="currentSalesReturn.customerId = this.value || null" ${currentSalesReturn.type === 'cash' ? 'disabled' : ''}>
                            ${customerOptions}
                        </select>
                    </td>
                </tr>
                <tr>
                    <td>مرجع</td>
                    <td colspan="3"><input value="${escapeHtml(currentSalesReturn.ref)}" oninput="currentSalesReturn.ref = this.value"></td>
                </tr>
            </table>
        </div>
        <div class="card">
            <select id="returnProduct">${productOptions}</select>
            <input id="returnQty" type="number" placeholder="الكمية" value="1">
            <button onclick="addReturnItem()">إضافة</button>
        </div>
        <div class="card">
            <table>
                <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr>
                ${rows}
            </table>
            <h3>الإجمالي: ${currentSalesReturn.items.reduce((s,i)=>s+(i.qty*i.price),0).toFixed(2)}</h3>
            <button onclick="saveSalesReturn()">حفظ</button>
            <button onclick="salesReturnPage()">إلغاء</button>
        </div>
    `;
}

function addReturnItem() {
    const select = document.getElementById('returnProduct');
    const selected = select.options[select.selectedIndex];
    const productId = parseInt(select.value);
    const productName = selected.text.split(' (')[0];
    const price = parseFloat(selected.dataset.price);
    const qty = parseFloat(document.getElementById('returnQty').value) || 0;
    if (qty <= 0) { alert('أدخل الكمية'); return; }
    const existing = currentSalesReturn.items.find(i => i.productId == productId);
    if (existing) {
        existing.qty += qty;
    } else {
        currentSalesReturn.items.push({ productId, name: productName, price, qty });
    }
    renderSalesReturnForm();
}

function changeReturnQty(i, val) {
    currentSalesReturn.items[i].qty = parseFloat(val) || 0;
    renderSalesReturnForm();
}

function changeReturnPrice(i, val) {
    currentSalesReturn.items[i].price = parseFloat(val) || 0;
    renderSalesReturnForm();
}

function removeReturnItem(i) {
    currentSalesReturn.items.splice(i, 1);
    renderSalesReturnForm();
}

function saveSalesReturn() {
    if (currentSalesReturn.items.length === 0) { alert('المرتجع فارغ'); return; }
    if (currentSalesReturn.type === 'credit' && !currentSalesReturn.customerId) { alert('اختر العميل للمرتجع الآجل'); return; }

    const period = query(`SELECT id FROM fiscal_periods WHERE status = 'Open' LIMIT 1`);
    if (!period.length) { alert('لا توجد فترة مالية مفتوحة.'); return; }
    const periodId = period[0][0];

    const total = currentSalesReturn.items.reduce((s,i) => s + (i.qty * i.price), 0);
    const returnNumber = getNextReturnNumber();
    const date = today();

    if (currentSalesReturn.type === 'credit') {
        for (const item of currentSalesReturn.items) {
            const soldQty = query(`
                SELECT COALESCE(SUM(sil.quantity), 0)
                FROM sales_invoice_lines sil
                JOIN sales_invoices si ON sil.invoice_id = si.id
                WHERE si.customer_id = ? AND sil.item_id = ? AND si.type = 'credit' AND si.status = 'Posted'
            `, [currentSalesReturn.customerId, item.productId])[0][0] || 0;

            const returnedQty = query(`
                SELECT COALESCE(SUM(srl.quantity), 0)
                FROM sales_return_lines srl
                JOIN sales_returns sr ON srl.return_id = sr.id
                WHERE sr.customer_id = ? AND srl.item_id = ? AND sr.status = 'Posted'
            `, [currentSalesReturn.customerId, item.productId])[0][0] || 0;

            const available = soldQty - returnedQty;
            if (item.qty > available) {
                alert(`الكمية المرتجعة (${item.qty}) من الصنف "${item.name}" تتجاوز الكمية المتاحة للإرجاع (${available}) للعميل.`);
                return;
            }
        }
    }

    run('BEGIN TRANSACTION');
    try {
        run(`INSERT INTO sales_returns (return_number, date, customer_id, total, currency, ref, type, status)
             VALUES (?, ?, ?, ?, 'YER', ?, ?, 'Posted')`,
            [returnNumber, date, currentSalesReturn.customerId || null, total, currentSalesReturn.ref, currentSalesReturn.type]);
        const returnId = query(`SELECT id FROM sales_returns WHERE return_number = ?`, [returnNumber])[0][0];

        let costOfGoodsReturned = 0;
        for (const item of currentSalesReturn.items) {
            const lineTotal = item.qty * item.price;
            run(`INSERT INTO sales_return_lines (return_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)`,
                [returnId, item.productId, item.qty, item.price, lineTotal]);
            run(`UPDATE items SET current_stock = current_stock + ? WHERE id = ?`, [item.qty, item.productId]);

            const costRow = query(`SELECT average_cost, purchase_cost FROM items WHERE id = ?`, [item.productId]);
            const cost = costRow.length ? (costRow[0][0] || costRow[0][1] || 0) : 0;
            costOfGoodsReturned += cost * item.qty;
        }

        const cashAccount = 11101;
        const salesReturnAccount = 4140;
        const inventoryAccount = 11701;
        const cogsAccount = 5100;

        let customerAccount = null;
        if (currentSalesReturn.type === 'credit') {
            const custRow = query(`SELECT account_id FROM partners WHERE id = ?`, [currentSalesReturn.customerId]);
            if (!custRow.length || !custRow[0][0]) throw new Error('العميل ليس له حساب');
            customerAccount = custRow[0][0];
        }

        const entryNumber = 'JV-SR-' + returnNumber;
        run(`INSERT INTO journal_entries (entry_number, date, description, period_id, status, auto_generated)
             VALUES (?, ?, ?, ?, 'Posted', 1)`,
            [entryNumber, date, `مرتجع مبيعات ${returnNumber}`, periodId]);
        const entryId = query(`SELECT id FROM journal_entries WHERE entry_number = ?`, [entryNumber])[0][0];

        if (currentSalesReturn.type === 'cash') {
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, salesReturnAccount, total]);
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, cashAccount, total]);
            window.updateAccountBalance(salesReturnAccount, total, 'debit');
            window.updateAccountBalance(cashAccount, total, 'credit');
        } else {
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, salesReturnAccount, total]);
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, customerAccount, total]);
            window.updateAccountBalance(salesReturnAccount, total, 'debit');
            window.updateAccountBalance(customerAccount, total, 'credit');
        }

        if (costOfGoodsReturned > 0) {
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, inventoryAccount, costOfGoodsReturned]);
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, cogsAccount, costOfGoodsReturned]);
            window.updateAccountBalance(inventoryAccount, costOfGoodsReturned, 'debit');
            window.updateAccountBalance(cogsAccount, costOfGoodsReturned, 'credit');
        }

        run(`UPDATE sales_returns SET journal_entry_id = ? WHERE id = ?`, [entryId, returnId]);
        run('COMMIT');
        saveDatabase();
        addLog('إضافة مرتجع مبيعات', returnNumber);
        alert('تم حفظ المرتجع والقيد المحاسبي');
        salesReturnsList();
    } catch (error) {
        run('ROLLBACK');
        alert('فشل حفظ المرتجع: ' + error.message);
        console.error(error);
    }
}

function editSalesReturn(id) {
    const ret = query(`SELECT * FROM sales_returns WHERE id = ?`, [id])[0];
    if (!ret) return;
    const lines = query(`SELECT item_id, quantity, unit_price FROM sales_return_lines WHERE return_id = ?`, [id]);
    currentSalesReturn = {
        type: ret[8] || 'cash',
        customerId: ret[3],
        ref: ret[6] || '',
        items: lines.map(l => ({
            productId: l[0],
            name: query(`SELECT name FROM items WHERE id = ?`, [l[0]])[0][0],
            price: l[2],
            qty: l[1]
        }))
    };
    window.editingReturnId = id;
    renderSalesReturnForm();
    setTimeout(() => {
        const saveBtn = document.querySelector('button[onclick="saveSalesReturn()"]');
        if (saveBtn) {
            saveBtn.textContent = 'تحديث المرتجع';
            saveBtn.onclick = function() { updateSalesReturn(id); };
        }
    }, 100);
}

function updateSalesReturn(id) {
    const oldRet = query(`SELECT return_number, total, customer_id FROM sales_returns WHERE id = ?`, [id])[0];
    if (!oldRet) return;
    const oldLines = query(`SELECT item_id, quantity FROM sales_return_lines WHERE return_id = ?`, [id]);

    if (currentSalesReturn.type === 'credit') {
        for (const item of currentSalesReturn.items) {
            const soldQty = query(`
                SELECT COALESCE(SUM(sil.quantity), 0)
                FROM sales_invoice_lines sil
                JOIN sales_invoices si ON sil.invoice_id = si.id
                WHERE si.customer_id = ? AND sil.item_id = ? AND si.type = 'credit' AND si.status = 'Posted'
            `, [currentSalesReturn.customerId, item.productId])[0][0] || 0;
            const returnedQty = query(`
                SELECT COALESCE(SUM(srl.quantity), 0)
                FROM sales_return_lines srl
                JOIN sales_returns sr ON srl.return_id = sr.id
                WHERE sr.customer_id = ? AND srl.item_id = ? AND sr.status = 'Posted' AND sr.id != ?
            `, [currentSalesReturn.customerId, item.productId, id])[0][0] || 0;
            const available = soldQty - returnedQty;
            if (item.qty > available) {
                alert(`الكمية المرتجعة (${item.qty}) من الصنف "${item.name}" تتجاوز الكمية المتاحة للإرجاع (${available}) للعميل.`);
                return;
            }
        }
    }

    oldLines.forEach(line => {
        run(`UPDATE items SET current_stock = current_stock - ? WHERE id = ?`, [line[1], line[0]]);
    });

    const oldEntryId = oldRet[8];
    if (oldEntryId) {
        run(`DELETE FROM journal_entry_lines WHERE entry_id = ?`, [oldEntryId]);
        run(`DELETE FROM journal_entries WHERE id = ?`, [oldEntryId]);
    }
    run(`DELETE FROM sales_return_lines WHERE return_id = ?`, [id]);

    const total = currentSalesReturn.items.reduce((s,i) => s + (i.qty * i.price), 0);
    let costOfGoodsReturned = 0;
    for (const item of currentSalesReturn.items) {
        run(`INSERT INTO sales_return_lines (return_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)`,
            [id, item.productId, item.qty, item.price, item.qty * item.price]);
        run(`UPDATE items SET current_stock = current_stock + ? WHERE id = ?`, [item.qty, item.productId]);
        const costRow = query(`SELECT average_cost, purchase_cost FROM items WHERE id = ?`, [item.productId]);
        const cost = costRow.length ? (costRow[0][0] || costRow[0][1] || 0) : 0;
        costOfGoodsReturned += cost * item.qty;
    }

    run(`UPDATE sales_returns SET customer_id = ?, ref = ?, total = ?, type = ? WHERE id = ?`,
        [currentSalesReturn.customerId || null, currentSalesReturn.ref, total, currentSalesReturn.type, id]);

    const entryNumber = 'JV-SR-UPD-' + oldRet[1];
    const periodId = query(`SELECT id FROM fiscal_periods WHERE status = 'Open' LIMIT 1`)[0]?.[0] || 1;
    run(`INSERT INTO journal_entries (entry_number, date, description, period_id, status, auto_generated)
         VALUES (?, date('now'), ?, ?, 'Posted', 1)`,
        [entryNumber, `تعديل مرتجع مبيعات ${oldRet[1]}`, periodId]);
    const entryId = query(`SELECT id FROM journal_entries WHERE entry_number = ?`, [entryNumber])[0][0];

    const salesReturnAccount = 4140;
    const inventoryAccount = 11701;
    const cogsAccount = 5100;
    const cashAccount = 11101;

    if (currentSalesReturn.type === 'cash') {
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, salesReturnAccount, total]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, cashAccount, total]);
        window.updateAccountBalance(salesReturnAccount, total, 'debit');
        window.updateAccountBalance(cashAccount, total, 'credit');
    } else {
        const custRow = query(`SELECT account_id FROM partners WHERE id = ?`, [currentSalesReturn.customerId]);
        if (!custRow.length || !custRow[0][0]) { alert('العميل ليس له حساب'); return; }
        const customerAccount = custRow[0][0];
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, salesReturnAccount, total]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, customerAccount, total]);
        window.updateAccountBalance(salesReturnAccount, total, 'debit');
        window.updateAccountBalance(customerAccount, total, 'credit');
    }

    if (costOfGoodsReturned > 0) {
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, inventoryAccount, costOfGoodsReturned]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, cogsAccount, costOfGoodsReturned]);
        window.updateAccountBalance(inventoryAccount, costOfGoodsReturned, 'debit');
        window.updateAccountBalance(cogsAccount, costOfGoodsReturned, 'credit');
    }

    run(`UPDATE sales_returns SET journal_entry_id = ? WHERE id = ?`, [entryId, id]);
    saveDatabase();
    window.editingReturnId = null;
    alert('تم تحديث المرتجع والمخزون والقيد');
    salesReturnsList();
}

function salesReturnsList() {
    const returns = query(`
        SELECT r.id, r.return_number, r.date, p.name, r.total
        FROM sales_returns r
        LEFT JOIN partners p ON r.customer_id = p.id
        WHERE r.status != 'Deleted'
        ORDER BY r.date DESC
    `);

    let rows = '';
    returns.forEach(ret => {
        rows += `<tr>
            <td>${escapeHtml(ret[1])}</td><td>${ret[2]}</td><td>${escapeHtml(ret[3] || '-')}</td><td>${ret[4].toFixed(2)}</td>
            <td>
                <button onclick="viewSalesReturn(${ret[0]})">عرض</button>
                ${canEditSale() ? `<button onclick="editSalesReturn(${ret[0]})">تعديل</button>` : ''}
                ${canDeleteSale() ? `<button onclick="deleteSalesReturn(${ret[0]})">حذف</button>` : ''}
            </td>
        </tr>`;
    });

    content.innerHTML = `
        <div class="card">
            <h3>مرتجعات المبيعات</h3>
        </div>
        <div class="card">
            <table>
                <tr><th>رقم</th><th>التاريخ</th><th>العميل</th><th>الإجمالي</th><th>العمليات</th></tr>
                ${rows || '<tr><td colspan="5">لا توجد مرتجعات</td></tr>'}
            </table>
            <button onclick="salesReturnPage()">رجوع</button>
        </div>
    `;
}

function deleteSalesReturn(id) {
    if (!confirm('حذف المرتجع؟ سيتم عكس القيد وإرجاع المخزون.')) return;
    const ret = query(`SELECT return_number, total, customer_id FROM sales_returns WHERE id = ?`, [id])[0];
    if (!ret) return;
    const lines = query(`SELECT item_id, quantity FROM sales_return_lines WHERE return_id = ?`, [id]);
    lines.forEach(line => {
        run(`UPDATE items SET current_stock = current_stock - ? WHERE id = ?`, [line[1], line[0]]);
    });
    run(`UPDATE sales_returns SET status = 'Deleted' WHERE id = ?`, [id]);
    saveDatabase();
    addLog('حذف مرتجع مبيعات', ret[0]);
    alert('تم حذف المرتجع');
    salesReturnsList();
}

function deletedSalesReturns() {
    const returns = query(`SELECT id, return_number, date, total FROM sales_returns WHERE status = 'Deleted'`);
    let rows = '';
    returns.forEach(ret => rows += `<tr><td>${escapeHtml(ret[1])}</td><td>${ret[2]}</td><td>${ret[3].toFixed(2)}</td>
        <td>${canDeleteSale() ? `<button onclick="restoreSalesReturn(${ret[0]})">استعادة</button>` : ''}</td></tr>`);
    content.innerHTML = `
        <div class="card"><h3>المرتجعات المحذوفة</h3></div>
        <div class="card">
            <table>
                <tr><th>رقم</th><th>التاريخ</th><th>الإجمالي</th><th></th></tr>
                ${rows || '<tr><td colspan="4">لا يوجد</td></tr>'}
            </table>
            <button onclick="salesReturnPage()">رجوع</button>
        </div>
    `;
}

function restoreSalesReturn(id) {
    run('BEGIN TRANSACTION');
    try {
        const lines = query(`SELECT item_id, quantity FROM sales_return_lines WHERE return_id = ?`, [id]);
        lines.forEach(line => {
            run(`UPDATE items SET current_stock = current_stock + ? WHERE id = ?`, [line[1], line[0]]);
        });
        run(`UPDATE sales_returns SET status = 'Posted' WHERE id = ?`, [id]);
        run('COMMIT');
        saveDatabase();
        deletedSalesReturns();
    } catch (e) {
        run('ROLLBACK');
        alert('فشل الاستعادة: ' + e.message);
    }
}

function viewSalesReturn(id) {
    window.previewDocument('sales_return', id);
}

// ======================== تعريض الدوال ========================
window.salesPage = salesPage;
window.salesInvoicePage = salesInvoicePage;
window.newSalesInvoice = newSalesInvoice;
window.salesInvoicesList = salesInvoicesList;
window.saveInvoice = saveInvoice;
window.addSaleItem = addSaleItem;
window.updateSaleItem = updateSaleItem;
window.removeSaleItem = removeSaleItem;
window.viewInvoice = viewInvoice;
window.editInvoice = editInvoice;
window.updateInvoice = updateInvoice;
window.deleteInvoice = deleteInvoice;
window.deletedSalesInvoices = deletedSalesInvoices;
window.restoreInvoice = restoreInvoice;
window.searchInvoice = searchInvoice;
window.quotesPage = quotesPage;
window.newQuote = newQuote;
window.saveQuote = saveQuote;
window.quotesList = quotesList;
window.viewQuote = viewQuote;
window.deleteQuote = deleteQuote;
window.convertQuoteToInvoice = convertQuoteToInvoice;
window.addQuoteItem = addQuoteItem;
window.renderQuoteForm = renderQuoteForm;
window.newSalesReturn = newSalesReturn;
window.salesReturnsList = salesReturnsList;
window.deletedSalesReturns = deletedSalesReturns;
window.saveSalesReturn = saveSalesReturn;
window.editSalesReturn = editSalesReturn;
window.updateSalesReturn = updateSalesReturn;
window.deleteSalesReturn = deleteSalesReturn;
window.restoreSalesReturn = restoreSalesReturn;
window.viewSalesReturn = viewSalesReturn;
window.addReturnItem = addReturnItem;
window.changeReturnQty = changeReturnQty;
window.changeReturnPrice = changeReturnPrice;
window.removeReturnItem = removeReturnItem;
window.renderSalesReturnForm = renderSalesReturnForm;
window.canEditSale = canEditSale;
window.canDeleteSale = canDeleteSale;