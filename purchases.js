// purchases.js - وحدة إدارة المشتريات (نسخة SQLite مع قيود تلقائية - صلاحيات)
console.log('📦 تحميل وحدة المشتريات...');

// ======================== دوال مساعدة ========================
function getSuppliersForSelect() {
    return query(`SELECT id, name FROM partners WHERE type IN ('Supplier','Both') AND deleted = 0 ORDER BY name`);
}

function getProductsForSelect() {
    return query(`SELECT id, name, purchase_cost, average_cost FROM items WHERE is_active = 1 ORDER BY name`);
}

function getNextPurchaseNumber() {
    const result = query(`SELECT invoice_number FROM purchase_invoices ORDER BY id DESC LIMIT 1`);
    if (!result.length) return 'PUR-000001';
    const last = result[0][0];
    const num = parseInt(last.replace('PUR-', '')) + 1;
    return 'PUR-' + String(num).padStart(6, '0');
}

function getNextPurchaseReturnNumber() {
    const result = query(`SELECT return_number FROM purchase_returns ORDER BY id DESC LIMIT 1`);
    if (!result.length) return 'PR-000001';
    const last = result[0][0];
    const num = parseInt(last.replace('PR-', '')) + 1;
    return 'PR-' + String(num).padStart(6, '0');
}

// ======================== دوال الصلاحيات ========================
function canEditPurchase() {
    return window.hasPermission ? window.hasPermission('edit_purchases') : true;
}
function canDeletePurchase() {
    return window.hasPermission ? window.hasPermission('delete_purchases') : true;
}

// ======================== الصفحات الرئيسية ========================
function purchasesPage() {
    content.innerHTML = `
        <div class="card">
            <h2><i class="fas fa-shopping-basket"></i> إدارة المشتريات</h2>
            <button onclick="purchaseInvoicePage()">📄 فواتير المشتريات</button>
            <button onclick="purchaseReturnsPage()">🔄 مرتجع المشتريات</button>
            <button onclick="deletedPurchaseInvoices()">🗑️ الفواتير المحذوفة</button>
            <button onclick="dashboard()">↩️ رجوع</button>
        </div>
    `;
}

function purchaseInvoicePage() {
    content.innerHTML = `
        <div class="card">
            <h3>فواتير المشتريات</h3>
            <button onclick="newPurchaseInvoice()">➕ إضافة فاتورة</button>
            <button onclick="purchaseInvoicesList()">📋 عرض الفواتير</button>
            <button onclick="purchasesPage()">↩️ رجوع</button>
        </div>
    `;
}

function purchaseReturnsPage() {
    content.innerHTML = `
        <div class="card">
            <h3>مرتجع المشتريات</h3>
            <button onclick="newPurchaseReturn()">➕ إضافة مرتجع</button>
            <button onclick="purchaseReturnsList()">📋 عرض المرتجعات</button>
            <button onclick="deletedPurchaseReturns()">🗑️ المرتجعات المحذوفة</button>
            <button onclick="purchasesPage()">↩️ رجوع</button>
        </div>
    `;
}

// ======================== نموذج فاتورة مشتريات جديد ========================
let currentPurchase = {
    type: 'cash',
    supplierId: null,
    currency: 'YER',
    ref: '',
    items: []
};

function newPurchaseInvoice() {
    currentPurchase = {
        type: 'cash',
        supplierId: null,
        currency: 'YER',
        ref: '',
        items: []
    };
    renderPurchaseForm();
}

function renderPurchaseForm() {
    const suppliers = getSuppliersForSelect();
    let supplierOptions = `<option value="">اختر مورد</option>`;
    suppliers.forEach(s => {
        supplierOptions += `<option value="${s[0]}" ${currentPurchase.supplierId == s[0] ? 'selected' : ''}>${escapeHtml(s[1])}</option>`;
    });

    const products = getProductsForSelect();
    let productOptions = '';
    products.forEach(p => {
        productOptions += `<option value="${p[0]}" data-cost="${p[2]}" data-avg="${p[3]}">${escapeHtml(p[1])}</option>`;
    });

    let rows = '';
    currentPurchase.items.forEach((item, i) => {
        rows += `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td><input type="number" value="${item.qty}" id="pqty_${i}" oninput="updatePurchaseItem(${i}, 'qty', this.value)" style="width:80px;"></td>
            <td><input type="number" value="${item.price}" id="pprice_${i}" oninput="updatePurchaseItem(${i}, 'price', this.value)" style="width:100px;"></td>
            <td id="ptotal_${i}">${(item.qty * item.price).toFixed(2)}</td>
            <td><button onclick="removePurchaseItem(${i})">حذف</button></td>
        </tr>`;
    });

    content.innerHTML = `
        <div class="card">
            <h2>${window.editingPurchaseId ? 'تعديل فاتورة مشتريات' : 'فاتورة مشتريات'}</h2>
            <table>
                <tr><td>رقم</td><td>${window.editingPurchaseId ? (query(`SELECT invoice_number FROM purchase_invoices WHERE id=?`, [window.editingPurchaseId])[0]?.[0] || '') : getNextPurchaseNumber()}</td><td>تاريخ</td><td>${today()}</td></tr>
                <tr>
                    <td>نوع</td>
                    <td>
                        <select onchange="currentPurchase.type = this.value; renderPurchaseForm()">
                            <option value="cash" ${currentPurchase.type == 'cash' ? 'selected' : ''}>نقد</option>
                            <option value="credit" ${currentPurchase.type == 'credit' ? 'selected' : ''}>آجل</option>
                        </select>
                    </td>
                    <td>المورد</td>
                    <td><select onchange="currentPurchase.supplierId = this.value || null">${supplierOptions}</select></td>
                </tr>
                <tr>
                    <td>عملة</td>
                    <td>
                        <select onchange="currentPurchase.currency = this.value">
                            <option value="YER" ${currentPurchase.currency == 'YER' ? 'selected' : ''}>ريال يمني</option>
                            <option value="SAR" ${currentPurchase.currency == 'SAR' ? 'selected' : ''}>ريال سعودي</option>
                            <option value="USD" ${currentPurchase.currency == 'USD' ? 'selected' : ''}>دولار</option>
                        </select>
                    </td>
                    <td>مرجع</td>
                    <td><input value="${escapeHtml(currentPurchase.ref)}" oninput="currentPurchase.ref = this.value"></td>
                </tr>
            </table>
        </div>
        <div class="card">
            <select id="purchaseProduct">${productOptions}</select>
            <input id="purchaseQty" type="number" placeholder="الكمية" value="1">
            <input id="purchasePrice" type="number" placeholder="السعر">
            <button onclick="addPurchaseItem()">إضافة</button>
        </div>
        <div class="card">
            <table>
                <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr>
                ${rows}
            </table>
            <h3>الإجمالي: <span id="purchaseGrandTotal">${purchaseTotal().toFixed(2)}</span></h3>
            <button onclick="savePurchaseInvoice()">${window.editingPurchaseId ? 'تحديث' : 'حفظ'}</button>
            <button onclick="purchaseInvoicePage()">إلغاء</button>
        </div>
    `;
}

function addPurchaseItem() {
    const select = document.getElementById('purchaseProduct');
    const selected = select.options[select.selectedIndex];
    const productId = parseInt(select.value);
    const productName = selected.text;
    const defaultCost = parseFloat(selected.dataset.cost) || 0;
    const qty = parseFloat(document.getElementById('purchaseQty').value) || 0;
    let price = parseFloat(document.getElementById('purchasePrice').value);
    if (!price || price <= 0) price = defaultCost;
    if (qty <= 0) { alert('أدخل الكمية'); return; }
    if (price <= 0) { alert('أدخل سعر صحيح'); return; }

    currentPurchase.items.push({ productId, name: productName, price, qty });

    const table = document.querySelector('table');
    if (table) {
        const index = currentPurchase.items.length - 1;
        const newRow = table.insertRow(-1);
        newRow.innerHTML = `
            <td>${escapeHtml(productName)}</td>
            <td><input type="number" value="${qty}" id="pqty_${index}" oninput="updatePurchaseItem(${index}, 'qty', this.value)" style="width:80px;"></td>
            <td><input type="number" value="${price}" id="pprice_${index}" oninput="updatePurchaseItem(${index}, 'price', this.value)" style="width:100px;"></td>
            <td id="ptotal_${index}">${(qty * price).toFixed(2)}</td>
            <td><button onclick="removePurchaseItem(${index})">حذف</button></td>
        `;
        document.getElementById('purchaseQty').value = '1';
        document.getElementById('purchasePrice').value = '';
        const grandTotal = document.getElementById('purchaseGrandTotal');
        if (grandTotal) grandTotal.innerText = purchaseTotal().toFixed(2);
    } else {
        renderPurchaseForm();
    }
}

function updatePurchaseItem(index, field, value) {
    const val = parseFloat(value) || 0;
    if (field === 'qty') {
        currentPurchase.items[index].qty = val;
    } else if (field === 'price') {
        currentPurchase.items[index].price = val;
    }
    const totalCell = document.getElementById(`ptotal_${index}`);
    if (totalCell) {
        totalCell.innerText = (currentPurchase.items[index].qty * currentPurchase.items[index].price).toFixed(2);
    }
    const grandTotal = document.getElementById('purchaseGrandTotal');
    if (grandTotal) {
        grandTotal.innerText = purchaseTotal().toFixed(2);
    }
}

function changePurchaseQty(i, val) { updatePurchaseItem(i, 'qty', val); }
function changePurchasePrice(i, val) { updatePurchaseItem(i, 'price', val); }

function removePurchaseItem(i) {
    currentPurchase.items.splice(i, 1);
    renderPurchaseForm();
}

function purchaseTotal() {
    return currentPurchase.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
}

function savePurchaseInvoice() {
    if (currentPurchase.items.length === 0) { alert('الفاتورة فارغة'); return; }
    if (!currentPurchase.supplierId) { alert('اختر المورد'); return; }

    const total = purchaseTotal();
    const invoiceNumber = getNextPurchaseNumber();
    const date = today();
    const periodId = query(`SELECT id FROM fiscal_periods WHERE status = 'Open' LIMIT 1`)[0]?.[0];

    run('BEGIN TRANSACTION');
    try {
        run(`INSERT INTO purchase_invoices (invoice_number, date, supplier_id, total, status, currency, ref, type)
             VALUES (?, ?, ?, ?, 'Posted', ?, ?, ?)`,
            [invoiceNumber, date, currentPurchase.supplierId, total, currentPurchase.currency, currentPurchase.ref, currentPurchase.type]);
        
        const idResult = query(`SELECT id FROM purchase_invoices WHERE invoice_number = ?`, [invoiceNumber]);
        if (!idResult.length) throw new Error('فشل استرداد رقم الفاتورة');
        const invoiceId = idResult[0][0];

        for (const item of currentPurchase.items) {
            const lineTotal = item.qty * item.price;
            run(`INSERT INTO purchase_invoice_lines (invoice_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)`,
                [invoiceId, item.productId, item.qty, item.price, lineTotal]);

            const oldItem = query(`SELECT current_stock, average_cost FROM items WHERE id = ?`, [item.productId])[0];
            const oldStock = oldItem ? oldItem[0] : 0;
            const oldAvgCost = oldItem ? (oldItem[1] || item.price) : item.price;
            
            let newAvgCost = item.price;
            if (oldStock > 0) {
                const totalOldValue = oldStock * oldAvgCost;
                const totalNewValue = item.qty * item.price;
                newAvgCost = (totalOldValue + totalNewValue) / (oldStock + item.qty);
            }

            run(`UPDATE items SET current_stock = current_stock + ?, average_cost = ?, purchase_cost = ? WHERE id = ?`, 
                [item.qty, newAvgCost, item.price, item.productId]);
        }

        const cashAccount = 11101;
        const inventoryAccount = 11701;

        const supplierRow = query(`SELECT account_id FROM partners WHERE id = ?`, [currentPurchase.supplierId]);
        if (!supplierRow.length || !supplierRow[0][0]) throw new Error('المورد ليس له حساب مرتبط');
        const supplierAccount = supplierRow[0][0];

        const entryNumber = 'JV-PUR-' + invoiceNumber;
        run(`INSERT INTO journal_entries (entry_number, date, description, period_id, status, auto_generated)
             VALUES (?, ?, ?, ?, 'Posted', 1)`,
            [entryNumber, date, `فاتورة مشتريات ${invoiceNumber}`, periodId]);
        const entryId = query(`SELECT id FROM journal_entries WHERE entry_number = ?`, [entryNumber])[0][0];

        if (currentPurchase.type === 'cash') {
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, inventoryAccount, total]);
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, cashAccount, total]);
            window.updateAccountBalance(inventoryAccount, total, 'debit');
            window.updateAccountBalance(cashAccount, total, 'credit');
        } else {
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, inventoryAccount, total]);
            run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, supplierAccount, total]);
            window.updateAccountBalance(inventoryAccount, total, 'debit');
            window.updateAccountBalance(supplierAccount, total, 'credit');
        }

        run(`UPDATE purchase_invoices SET journal_entry_id = ? WHERE id = ?`, [entryId, invoiceId]);
        run('COMMIT');
        saveDatabase();
        addLog('إضافة فاتورة مشتريات', invoiceNumber);
        alert('تم حفظ الفاتورة والقيد المحاسبي');
        purchaseInvoicesList();
    } catch (error) {
        run('ROLLBACK');
        alert('فشل حفظ الفاتورة: ' + error.message);
        console.error(error);
    }
}

// ======================== عرض فواتير المشتريات ========================
function purchaseInvoicesList() {
    const invoices = query(`
        SELECT p.id, p.invoice_number, p.date, s.name, p.type, p.total
        FROM purchase_invoices p
        LEFT JOIN partners s ON p.supplier_id = s.id
        WHERE p.status != 'Deleted'
        ORDER BY p.date DESC, p.id DESC
    `);

    let rows = '';
    invoices.forEach(inv => {
        rows += `<tr>
            <td>${escapeHtml(inv[1])}</td><td>${inv[2]}</td><td>${escapeHtml(inv[3] || '-')}</td><td>${inv[4] || 'نقد'}</td><td>${inv[5].toFixed(2)}</td>
            <td>
                <button onclick="viewPurchase(${inv[0]})">عرض</button>
                ${canEditPurchase() ? `<button onclick="editPurchase(${inv[0]})">تعديل</button>` : ''}
                ${canDeletePurchase() ? `<button onclick="deletePurchase(${inv[0]})">حذف</button>` : ''}
            </td>
        </tr>`;
    });

    content.innerHTML = `
        <div class="card">
            <h3>فواتير المشتريات</h3>
            <input id="searchPurchase" placeholder="بحث..." onkeyup="searchPurchase()">
        </div>
        <div class="card">
            <table>
                <tr><th>رقم</th><th>التاريخ</th><th>المورد</th><th>النوع</th><th>الإجمالي</th><th>العمليات</th></tr>
                ${rows || '<tr><td colspan="6">لا توجد فواتير</td></tr>'}
            </table>
            <button onclick="purchaseInvoicePage()">رجوع</button>
        </div>
    `;
}

function searchPurchase() {
    const q = document.getElementById('searchPurchase').value.toLowerCase();
    const invoices = query(`
        SELECT p.id, p.invoice_number, p.date, s.name, p.type, p.total
        FROM purchase_invoices p
        LEFT JOIN partners s ON p.supplier_id = s.id
        WHERE p.status != 'Deleted' AND (LOWER(p.invoice_number) LIKE ? OR LOWER(s.name) LIKE ?)
        ORDER BY p.date DESC
    `, [`%${q}%`, `%${q}%`]);

    let rows = '';
    invoices.forEach(inv => {
        rows += `<tr>
            <td>${escapeHtml(inv[1])}</td><td>${inv[2]}</td><td>${escapeHtml(inv[3] || '-')}</td><td>${inv[4] || 'نقد'}</td><td>${inv[5].toFixed(2)}</td>
            <td>
                <button onclick="viewPurchase(${inv[0]})">عرض</button>
                ${canEditPurchase() ? `<button onclick="editPurchase(${inv[0]})">تعديل</button>` : ''}
                ${canDeletePurchase() ? `<button onclick="deletePurchase(${inv[0]})">حذف</button>` : ''}
            </td>
        </tr>`;
    });

    document.querySelector('table').innerHTML = `
        <tr><th>رقم</th><th>التاريخ</th><th>المورد</th><th>النوع</th><th>الإجمالي</th><th>العمليات</th></tr>
        ${rows}
    `;
}

function viewPurchase(id) {
    window.previewDocument('purchase', id);
}

function deletePurchase(id) {
    const inv = query(`SELECT invoice_number, supplier_id, type, total, journal_entry_id FROM purchase_invoices WHERE id = ?`, [id])[0];
    if (!inv) return;
    if (!confirm(`حذف الفاتورة ${inv[0]}؟ سيتم إرجاع المخزون وعكس القيد المحاسبي.`)) return;

    const invoiceNumber = inv[0];
    const supplierId = inv[1];
    const type = inv[2];
    const total = inv[3];
    const oldEntryId = inv[4];

    const lines = query(`SELECT item_id, quantity FROM purchase_invoice_lines WHERE invoice_id = ?`, [id]);
    lines.forEach(line => {
        run(`UPDATE items SET current_stock = current_stock - ? WHERE id = ?`, [line[1], line[0]]);
    });

    const periodId = query(`SELECT id FROM fiscal_periods WHERE status = 'Open' LIMIT 1`)[0]?.[0];
    const revEntryNumber = 'REV-PUR-' + invoiceNumber;
    run(`INSERT INTO journal_entries (entry_number, date, description, period_id, status, auto_generated)
         VALUES (?, date('now'), ?, ?, 'Posted', 1)`,
        [revEntryNumber, `إلغاء فاتورة مشتريات ${invoiceNumber}`, periodId]);
    const revEntryId = query(`SELECT last_insert_rowid()`)[0][0];

    const cashAccount = 11101;
    const inventoryAccount = 11701;
    const supplierRow = query(`SELECT account_id FROM partners WHERE id = ?`, [supplierId]);
    const supplierAccount = supplierRow.length ? supplierRow[0][0] : null;

    if (type === 'cash') {
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [revEntryId, cashAccount, total]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [revEntryId, inventoryAccount, total]);
        window.updateAccountBalance(cashAccount, total, 'debit');
        window.updateAccountBalance(inventoryAccount, total, 'credit');
    } else {
        if (!supplierAccount) { alert('لا يمكن عكس القيد: المورد ليس له حساب'); return; }
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [revEntryId, supplierAccount, total]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [revEntryId, inventoryAccount, total]);
        window.updateAccountBalance(supplierAccount, total, 'debit');
        window.updateAccountBalance(inventoryAccount, total, 'credit');
    }

    run(`UPDATE purchase_invoices SET status = 'Deleted', journal_entry_id = ? WHERE id = ?`, [revEntryId, id]);
    if (oldEntryId) run(`UPDATE journal_entries SET status = 'Reversed' WHERE id = ?`, [oldEntryId]);

    saveDatabase();
    addLog('حذف فاتورة مشتريات', invoiceNumber);
    alert('تم حذف الفاتورة وإرجاع المخزون وعكس القيد');
    purchaseInvoicesList();
}

function editPurchase(id) {
    const inv = query(`SELECT * FROM purchase_invoices WHERE id = ?`, [id])[0];
    if (!inv) return;

    const lines = query(`SELECT item_id, quantity, unit_price FROM purchase_invoice_lines WHERE invoice_id = ?`, [id]);
    
    currentPurchase = {
        type: inv[7],
        supplierId: inv[3],
        currency: inv[5],
        ref: inv[6] || '',
        items: lines.map(l => ({
            productId: l[0],
            name: query(`SELECT name FROM items WHERE id = ?`, [l[0]])[0][0],
            price: l[2],
            qty: l[1]
        }))
    };

    window.editingPurchaseId = id;
    renderPurchaseForm();
    
    setTimeout(() => {
        const saveBtn = document.querySelector('button[onclick="savePurchaseInvoice()"]');
        if (saveBtn) {
            saveBtn.textContent = 'تحديث الفاتورة';
            saveBtn.onclick = function() { updatePurchase(id); };
        }
    }, 100);
}

function updatePurchase(id) {
    const oldInv = query(`SELECT invoice_number, type, total, supplier_id FROM purchase_invoices WHERE id = ?`, [id])[0];
    if (!oldInv) return;

    // عكس المخزون القديم
    const oldLines = query(`SELECT item_id, quantity FROM purchase_invoice_lines WHERE invoice_id = ?`, [id]);
    oldLines.forEach(line => {
        run(`UPDATE items SET current_stock = current_stock - ? WHERE id = ?`, [line[1], line[0]]);
    });

    // عكس القيد القديم
    const oldEntryId = query(`SELECT journal_entry_id FROM purchase_invoices WHERE id = ?`, [id])[0]?.[0];
    if (oldEntryId) {
        run(`DELETE FROM journal_entry_lines WHERE entry_id = ?`, [oldEntryId]);
        run(`DELETE FROM journal_entries WHERE id = ?`, [oldEntryId]);
    }

    // حذف البنود القديمة
    run(`DELETE FROM purchase_invoice_lines WHERE invoice_id = ?`, [id]);

    // إعادة إدراج البنود الجديدة
    const total = purchaseTotal();
    run(`UPDATE purchase_invoices SET type = ?, supplier_id = ?, currency = ?, ref = ?, total = ? WHERE id = ?`,
        [currentPurchase.type, currentPurchase.supplierId, currentPurchase.currency, currentPurchase.ref, total, id]);

    for (const item of currentPurchase.items) {
        const lineTotal = item.qty * item.price;
        run(`INSERT INTO purchase_invoice_lines (invoice_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)`,
            [id, item.productId, item.qty, item.price, lineTotal]);

        // تحديث المخزون ومتوسط التكلفة
        const oldItem = query(`SELECT current_stock, average_cost FROM items WHERE id = ?`, [item.productId])[0];
        const oldStock = oldItem ? oldItem[0] : 0;
        const oldAvgCost = oldItem ? (oldItem[1] || item.price) : item.price;
        
        let newAvgCost = item.price;
        if (oldStock > 0) {
            const totalOldValue = oldStock * oldAvgCost;
            const totalNewValue = item.qty * item.price;
            newAvgCost = (totalOldValue + totalNewValue) / (oldStock + item.qty);
        }

        run(`UPDATE items SET current_stock = current_stock + ?, average_cost = ?, purchase_cost = ? WHERE id = ?`, 
            [item.qty, newAvgCost, item.price, item.productId]);
    }

    // إنشاء قيد جديد
    const entryNumber = 'JV-PUR-UPD-' + oldInv[0];
    const periodId = query(`SELECT id FROM fiscal_periods WHERE status = 'Open' LIMIT 1`)[0]?.[0] || 1;
    run(`INSERT INTO journal_entries (entry_number, date, description, period_id, status, auto_generated)
         VALUES (?, date('now'), ?, ?, 'Posted', 1)`,
        [entryNumber, `تعديل فاتورة مشتريات ${oldInv[0]}`, periodId]);
    const entryId = query(`SELECT id FROM journal_entries WHERE entry_number = ?`, [entryNumber])[0][0];

    const cashAccount = 11101;
    const inventoryAccount = 11701;
    const supplierRow = query(`SELECT account_id FROM partners WHERE id = ?`, [currentPurchase.supplierId]);
    if (!supplierRow.length || !supplierRow[0][0]) { alert('المورد ليس له حساب'); return; }
    const supplierAccount = supplierRow[0][0];

    if (currentPurchase.type === 'cash') {
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, inventoryAccount, total]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, cashAccount, total]);
        window.updateAccountBalance(inventoryAccount, total, 'debit');
        window.updateAccountBalance(cashAccount, total, 'credit');
    } else {
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, inventoryAccount, total]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, supplierAccount, total]);
        window.updateAccountBalance(inventoryAccount, total, 'debit');
        window.updateAccountBalance(supplierAccount, total, 'credit');
    }

    run(`UPDATE purchase_invoices SET journal_entry_id = ? WHERE id = ?`, [entryId, id]);
    saveDatabase();
    window.editingPurchaseId = null;
    alert('تم تحديث الفاتورة والمخزون والقيد');
    purchaseInvoicesList();
}

function deletedPurchaseInvoices() {
    const invoices = query(`
        SELECT id, invoice_number, date, total
        FROM purchase_invoices
        WHERE status = 'Deleted'
        ORDER BY date DESC
    `);
    let rows = '';
    invoices.forEach(inv => {
        rows += `<tr>
            <td>${escapeHtml(inv[1])}</td>
            <td>${inv[2]}</td>
            <td>${inv[3].toFixed(2)}</td>
            <td>
                ${canDeletePurchase() ? `<button onclick="restorePurchase(${inv[0]})">استعادة</button>` : ''}
                ${canDeletePurchase() ? `<button onclick="permanentlyDeletePurchase(${inv[0]})">حذف نهائي</button>` : ''}
            </td>
        </tr>`;
    });
    content.innerHTML = `
        <div class="card">
            <h3>فواتير المشتريات المحذوفة</h3>
        </div>
        <div class="card">
            <table>
                <tr><th>الرقم</th><th>التاريخ</th><th>الإجمالي</th><th>إجراءات</th></tr>
                ${rows || '<tr><td colspan="4">لا توجد فواتير محذوفة</td></tr>'}
            </table>
            <button onclick="purchaseInvoicePage()">رجوع</button>
        </div>
    `;
}

function restorePurchase(id) {
    const inv = query(`SELECT invoice_number, supplier_id, type, total FROM purchase_invoices WHERE id = ?`, [id])[0];
    if (!inv) return;
    if (!confirm(`استعادة الفاتورة ${inv[0]}؟`)) return;

    const invoiceNumber = inv[0];
    const supplierId = inv[1];
    const type = inv[2];
    const total = inv[3];

    const lines = query(`SELECT item_id, quantity FROM purchase_invoice_lines WHERE invoice_id = ?`, [id]);
    lines.forEach(line => {
        run(`UPDATE items SET current_stock = current_stock + ? WHERE id = ?`, [line[1], line[0]]);
    });

    run(`UPDATE purchase_invoices SET status = 'Posted' WHERE id = ?`, [id]);

    const periodId = query(`SELECT id FROM fiscal_periods WHERE status = 'Open' LIMIT 1`)[0]?.[0];
    const entryNumber = 'JV-PUR-RES-' + invoiceNumber;
    run(`INSERT INTO journal_entries (entry_number, date, description, period_id, status, auto_generated)
         VALUES (?, date('now'), ?, ?, 'Posted', 1)`,
        [entryNumber, `استعادة فاتورة مشتريات ${invoiceNumber}`, periodId]);
    const entryId = query(`SELECT last_insert_rowid()`)[0][0];

    const cashAccount = 11101;
    const inventoryAccount = 11701;
    const supplierRow = query(`SELECT account_id FROM partners WHERE id = ?`, [supplierId]);
    if (!supplierRow.length || !supplierRow[0][0]) { alert('المورد ليس له حساب'); return; }
    const supplierAccount = supplierRow[0][0];

    if (type === 'cash') {
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, inventoryAccount, total]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, cashAccount, total]);
        window.updateAccountBalance(inventoryAccount, total, 'debit');
        window.updateAccountBalance(cashAccount, total, 'credit');
    } else {
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, inventoryAccount, total]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, supplierAccount, total]);
        window.updateAccountBalance(inventoryAccount, total, 'debit');
        window.updateAccountBalance(supplierAccount, total, 'credit');
    }

    run(`UPDATE purchase_invoices SET journal_entry_id = ? WHERE id = ?`, [entryId, id]);

    saveDatabase();
    addLog('استعادة فاتورة مشتريات', invoiceNumber);
    alert('تم استعادة الفاتورة');
    deletedPurchaseInvoices();
}

function permanentlyDeletePurchase(id) {
    if (!confirm('سيتم حذف الفاتورة نهائياً. لا يمكن التراجع.')) return;
    run(`DELETE FROM purchase_invoice_lines WHERE invoice_id = ?`, [id]);
    run(`DELETE FROM purchase_invoices WHERE id = ?`, [id]);
    saveDatabase();
    alert('تم الحذف النهائي');
    deletedPurchaseInvoices();
}

// ======================== مرتجعات المشتريات ========================
let currentPurchaseReturn = { supplierId: null, currency: 'YER', ref: '', items: [], type: 'cash' };

function newPurchaseReturn() {
    currentPurchaseReturn = { supplierId: null, currency: 'YER', ref: '', items: [], type: 'cash' };
    renderPurchaseReturnForm();
}

function renderPurchaseReturnForm() {
    const suppliers = getSuppliersForSelect();
    let supplierOptions = `<option value="">اختر المورد</option>`;
    suppliers.forEach(s => supplierOptions += `<option value="${s[0]}" ${currentPurchaseReturn.supplierId == s[0] ? 'selected' : ''}>${escapeHtml(s[1])}</option>`);

    const products = getProductsForSelect();
    let productOptions = '';
    products.forEach(p => productOptions += `<option value="${p[0]}">${escapeHtml(p[1])}</option>`);

    let rows = '';
    currentPurchaseReturn.items.forEach((item, i) => {
        rows += `<tr><td>${escapeHtml(item.name)}</td><td><input type="number" value="${item.qty}" onchange="currentPurchaseReturn.items[${i}].qty=parseFloat(this.value);renderPurchaseReturnForm()"></td>
            <td><input type="number" value="${item.price}" onchange="currentPurchaseReturn.items[${i}].price=parseFloat(this.value);renderPurchaseReturnForm()"></td>
            <td>${(item.qty * item.price).toFixed(2)}</td><td><button onclick="currentPurchaseReturn.items.splice(${i},1);renderPurchaseReturnForm()">حذف</button></td></tr>`;
    });

    content.innerHTML = `
        <div class="card"><h2>مرتجع مشتريات</h2>
            <table>
                <tr><td>رقم</td><td>${getNextPurchaseReturnNumber()}</td><td>تاريخ</td><td>${today()}</td></tr>
                <tr>
                    <td>المورد</td>
                    <td><select onchange="currentPurchaseReturn.supplierId = this.value || null">${supplierOptions}</select></td>
                    <td>النوع</td>
                    <td>
                        <select onchange="currentPurchaseReturn.type = this.value">
                            <option value="cash" ${currentPurchaseReturn.type == 'cash' ? 'selected' : ''}>نقد</option>
                            <option value="credit" ${currentPurchaseReturn.type == 'credit' ? 'selected' : ''}>آجل</option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <td>عملة</td>
                    <td>
                        <select onchange="currentPurchaseReturn.currency = this.value">
                            <option value="YER" ${currentPurchaseReturn.currency == 'YER' ? 'selected' : ''}>ريال يمني</option>
                            <option value="SAR" ${currentPurchaseReturn.currency == 'SAR' ? 'selected' : ''}>ريال سعودي</option>
                            <option value="USD" ${currentPurchaseReturn.currency == 'USD' ? 'selected' : ''}>دولار</option>
                        </select>
                    </td>
                    <td>مرجع</td>
                    <td><input value="${escapeHtml(currentPurchaseReturn.ref)}" oninput="currentPurchaseReturn.ref = this.value"></td>
                </tr>
            </table>
        </div>
        <div class="card">
            <select id="prProduct">${productOptions}</select>
            <input id="prQty" type="number" placeholder="الكمية" value="1">
            <input id="prPrice" type="number" placeholder="السعر">
            <button onclick="addPurchaseReturnItem()">إضافة</button>
        </div>
        <div class="card">
            <table><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr>${rows}</table>
            <h3>الإجمالي: ${currentPurchaseReturn.items.reduce((s,i)=>s+i.qty*i.price,0).toFixed(2)}</h3>
            <button onclick="savePurchaseReturn()">حفظ</button>
            <button onclick="purchaseReturnsPage()">إلغاء</button>
        </div>
    `;
}

function addPurchaseReturnItem() {
    const productId = parseInt(document.getElementById('prProduct').value);
    const qty = parseFloat(document.getElementById('prQty').value) || 0;
    const price = parseFloat(document.getElementById('prPrice').value) || 0;
    if (qty <= 0 || price <= 0) { alert('أدخل كمية وسعر صحيحين'); return; }
    const stock = query(`SELECT current_stock FROM items WHERE id = ?`, [productId])[0][0] || 0;
    if (qty > stock) { alert(`المخزون غير كافٍ (المتوفر: ${stock})`); return; }
    const product = query(`SELECT name FROM items WHERE id = ?`, [productId])[0];
    currentPurchaseReturn.items.push({ productId, name: product[0], qty, price });
    renderPurchaseReturnForm();
}

function savePurchaseReturn() {
    if (currentPurchaseReturn.items.length === 0) { alert('المرتجع فارغ'); return; }
    if (!currentPurchaseReturn.supplierId) { alert('اختر المورد'); return; }

    const total = currentPurchaseReturn.items.reduce((s,i)=>s+i.qty*i.price,0);
    const returnNumber = getNextPurchaseReturnNumber();
    const date = today();
    const periodId = query(`SELECT id FROM fiscal_periods WHERE status = 'Open' LIMIT 1`)[0]?.[0];

    const returnType = currentPurchaseReturn.type || 'cash';

    run(`INSERT INTO purchase_returns (return_number, date, supplier_id, total, status, currency, ref)
         VALUES (?, ?, ?, ?, 'Posted', ?, ?)`, 
         [returnNumber, date, currentPurchaseReturn.supplierId, total, currentPurchaseReturn.currency, currentPurchaseReturn.ref]);
    
    const idResult = query(`SELECT id FROM purchase_returns WHERE return_number = ?`, [returnNumber]);
    if (!idResult.length) { alert('❌ فشل استرداد رقم المرتجع'); return; }
    const returnId = idResult[0][0];

    currentPurchaseReturn.items.forEach(item => {
        run(`INSERT INTO purchase_return_lines (return_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)`,
            [returnId, item.productId, item.qty, item.price, item.qty * item.price]);
        run(`UPDATE items SET current_stock = current_stock - ? WHERE id = ?`, [item.qty, item.productId]);
    });

    const cashAccount = 11101;
    const inventoryAccount = 11701;
    const supplierRow = query(`SELECT account_id FROM partners WHERE id = ?`, [currentPurchaseReturn.supplierId]);
    if (!supplierRow.length || !supplierRow[0][0]) { alert('❌ المورد ليس له حساب'); return; }
    const supplierAccount = supplierRow[0][0];

    const entryNumber = 'JV-PR-' + returnNumber;
    run(`INSERT INTO journal_entries (entry_number, date, description, period_id, status, auto_generated)
         VALUES (?, ?, ?, ?, 'Posted', 1)`, 
         [entryNumber, date, `مرتجع مشتريات ${returnNumber}`, periodId]);
    const entryId = query(`SELECT id FROM journal_entries WHERE entry_number = ?`, [entryNumber])[0][0];

    if (returnType === 'cash') {
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, cashAccount, total]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, inventoryAccount, total]);
        window.updateAccountBalance(cashAccount, total, 'debit');
        window.updateAccountBalance(inventoryAccount, total, 'credit');
    } else {
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)`, [entryId, supplierAccount, total]);
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)`, [entryId, inventoryAccount, total]);
        window.updateAccountBalance(supplierAccount, total, 'debit');
        window.updateAccountBalance(inventoryAccount, total, 'credit');
    }

    run(`UPDATE purchase_returns SET journal_entry_id = ? WHERE id = ?`, [entryId, returnId]);
    saveDatabase();
    addLog('إضافة مرتجع مشتريات', returnNumber);
    alert('تم حفظ المرتجع والقيد المحاسبي');
    purchaseReturnsList();
}

function purchaseReturnsList() {
    const returns = query(`SELECT r.id, r.return_number, r.date, s.name, r.total FROM purchase_returns r LEFT JOIN partners s ON r.supplier_id = s.id WHERE r.status != 'Deleted' ORDER BY r.date DESC`);
    let rows = '';
    returns.forEach(r => rows += `<tr><td>${escapeHtml(r[1])}</td><td>${r[2]}</td><td>${escapeHtml(r[3]||'-')}</td><td>${r[4].toFixed(2)}</td>
        <td>
            <button onclick="viewPurchaseReturn(${r[0]})">عرض</button>
            ${canDeletePurchase() ? `<button onclick="deletePurchaseReturn(${r[0]})">حذف</button>` : ''}
        </td></tr>`);
    content.innerHTML = `<div class="card"><h3>مرتجعات المشتريات</h3><button onclick="purchaseReturnsPage()">رجوع</button></div><div class="card"><table><tr><th>رقم</th><th>التاريخ</th><th>المورد</th><th>الإجمالي</th><th>العمليات</th></tr>${rows}</table></div>`;
}

function viewPurchaseReturn(id) {
    window.previewDocument('purchase_return', id);
}

function deletePurchaseReturn(id) {
    if (!confirm('حذف المرتجع؟')) return;
    const lines = query(`SELECT item_id, quantity FROM purchase_return_lines WHERE return_id = ?`, [id]);
    lines.forEach(line => {
        run(`UPDATE items SET current_stock = current_stock + ? WHERE id = ?`, [line[1], line[0]]);
    });
    run(`UPDATE purchase_returns SET status = 'Deleted' WHERE id = ?`, [id]);
    saveDatabase();
    purchaseReturnsList();
}

function deletedPurchaseReturns() {
    const returns = query(`SELECT id, return_number, date, total FROM purchase_returns WHERE status = 'Deleted'`);
    let rows = '';
    returns.forEach(r => rows += `<tr><td>${escapeHtml(r[1])}</td><td>${r[2]}</td><td>${r[3].toFixed(2)}</td>
        <td>${canDeletePurchase() ? `<button onclick="restorePurchaseReturn(${r[0]})">استعادة</button>` : ''}</td></tr>`);
    content.innerHTML = `<div class="card"><h3>المرتجعات المحذوفة</h3></div><div class="card"><table><tr><th>رقم</th><th>التاريخ</th><th>الإجمالي</th><th></th></tr>${rows}</table><button onclick="purchaseReturnsPage()">رجوع</button></div>`;
}

function restorePurchaseReturn(id) {
    const lines = query(`SELECT item_id, quantity FROM purchase_return_lines WHERE return_id = ?`, [id]);
    lines.forEach(line => {
        run(`UPDATE items SET current_stock = current_stock - ? WHERE id = ?`, [line[1], line[0]]);
    });
    run(`UPDATE purchase_returns SET status = 'Posted' WHERE id = ?`, [id]);
    saveDatabase();
    deletedPurchaseReturns();
}

// تعريض الدوال
window.purchasesPage = purchasesPage;
window.purchaseInvoicePage = purchaseInvoicePage;
window.newPurchaseInvoice = newPurchaseInvoice;
window.purchaseInvoicesList = purchaseInvoicesList;
window.savePurchaseInvoice = savePurchaseInvoice;
window.addPurchaseItem = addPurchaseItem;
window.changePurchaseQty = changePurchaseQty;
window.changePurchasePrice = changePurchasePrice;
window.removePurchaseItem = removePurchaseItem;
window.viewPurchase = viewPurchase;
window.editPurchase = editPurchase;
window.updatePurchase = updatePurchase;
window.deletePurchase = deletePurchase;
window.searchPurchase = searchPurchase;
window.deletedPurchaseInvoices = deletedPurchaseInvoices;
window.restorePurchase = restorePurchase;
window.permanentlyDeletePurchase = permanentlyDeletePurchase;
window.purchaseReturnsPage = purchaseReturnsPage;
window.newPurchaseReturn = newPurchaseReturn;
window.purchaseReturnsList = purchaseReturnsList;
window.savePurchaseReturn = savePurchaseReturn;
window.addPurchaseReturnItem = addPurchaseReturnItem;
window.deletePurchaseReturn = deletePurchaseReturn;
window.restorePurchaseReturn = restorePurchaseReturn;
window.deletedPurchaseReturns = deletedPurchaseReturns;
window.viewPurchaseReturn = viewPurchaseReturn;
window.canEditPurchase = canEditPurchase;
window.canDeletePurchase = canDeletePurchase;