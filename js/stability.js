// ============================================= // stability.js // Safe Stability Layer for ERP System // Designed for multi-file architecture (13+ files) // Environment: Android + Acode + sql.js // ZERO BREAKING CHANGES // =============================================

// -------------------------------------------------- // INIT AFTER SYSTEM LOAD // --------------------------------------------------

window.addEventListener("load", function () {

console.log("Stability layer loaded");

try {
    setupDebouncedSave();
    setupAccountCache();
    autoBackupOncePerDay();
}
catch (e) {
    console.error("Stability init failed", e);
}

});

// -------------------------------------------------- // 1) SAFE DEBOUNCED SAVE (OVERRIDE) // --------------------------------------------------

function setupDebouncedSave() {

if (typeof saveDatabase !== "function") {
    console.warn("saveDatabase not found");
    return;
}

const originalSave = saveDatabase;

let saveTimer = null;

window.saveDatabase = function () {

    if (saveTimer)
        clearTimeout(saveTimer);

    saveTimer = setTimeout(function () {

        try {
            originalSave();
            console.log("Database saved (debounced)");
        }
        catch (e) {
            console.error("Save failed", e);
        }

    }, 800);

};

}

// -------------------------------------------------- // 2) TRANSACTION WRAPPER (OPTIONAL USE) // --------------------------------------------------

window.runTransaction = function (callback) {

if (!window.db) {
    console.error("Database not ready");
    return;
}

try {

    db.run("BEGIN");

    callback();

    db.run("COMMIT");

    if (typeof saveDatabase === "function")
        saveDatabase();

}
catch (e) {

    console.error("Transaction failed", e);

    try {
        db.run("ROLLBACK");
    }
    catch (rollbackError) {
        console.error("Rollback failed", rollbackError);
    }

    throw e;

}

};

// -------------------------------------------------- // 3) PREVENT DOUBLE EXECUTION // --------------------------------------------------

window.guardExecution = function (fn) {

let busy = false;

return async function (...args) {

    if (busy) {
        console.warn("Operation already running");
        return;
    }

    busy = true;

    try {
        return await fn.apply(this, args);
    }
    catch (e) {
        console.error("Guarded execution error", e);
        throw e;
    }
    finally {
        busy = false;
    }

};

};

// -------------------------------------------------- // 4) AUTO BACKUP (ONCE PER DAY) // --------------------------------------------------

function autoBackupOncePerDay() {

if (!window.db)
    return;

try {

    const last = localStorage.getItem("last_backup");

    const now = Date.now();

    const ONE_DAY = 86400000;

    if (!last || now - Number(last) > ONE_DAY) {

        const data = db.export();

        const blob = new Blob(
            [data],
            { type: "application/octet-stream" }
        );

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;

        const date = new Date()
            .toISOString()
            .slice(0, 10);

        a.download = "backup-" + date + ".db";

        document.body.appendChild(a);

        a.click();

        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        localStorage.setItem(
            "last_backup",
            now
        );

        console.log("Automatic backup created");

    }

}
catch (e) {

    console.error("Auto backup failed", e);

}

}

// -------------------------------------------------- // 5) JOURNAL ENTRY VALIDATION (OPTIONAL) // --------------------------------------------------

window.validateEntrySafe = function (lines) {

if (!Array.isArray(lines))
    return true;

if (lines.length < 2)
    throw new Error("القيد يحتاج سطرين على الأقل");

let debit = 0;
let credit = 0;

for (const line of lines) {

    const d = Number(line.debit) || 0;
    const c = Number(line.credit) || 0;

    if (d > 0 && c > 0)
        throw new Error("السطر لا يمكن أن يكون مدين ودائن");

    if (d === 0 && c === 0)
        throw new Error("السطر بدون مبلغ");

    debit += d;
    credit += c;

}

if (debit !== credit)
    throw new Error("القيد غير متوازن");

return true;

};

// -------------------------------------------------- // 6) SAFE DATABASE RESET // --------------------------------------------------

window.resetDatabaseOnly = function () {

if (!confirm("هل تريد حذف قاعدة البيانات فقط؟"))
    return;

try {

    localStorage.removeItem("accounting_db");

    alert("تم حذف قاعدة البيانات");

    location.reload();

}
catch (e) {

    console.error("Reset failed", e);

}

};

// -------------------------------------------------- // 7) ACCOUNT OPTIONS CACHE (SAFE OVERRIDE) // --------------------------------------------------

function setupAccountCache() {

if (typeof getAccountOptions !== "function")
    return;

const original = getAccountOptions;

let cache = null;

window.getAccountOptions = function () {

    if (cache)
        return cache;

    cache = original();

    return cache;

};

window.clearAccountCache = function () {

    cache = null;
};

}

// -------------------------------------------------- // EXTRA SAFETY: SAVE BEFORE EXIT // --------------------------------------------------

window.addEventListener("beforeunload", function () {

try {

    if (typeof saveDatabase === "function")
        saveDatabase();

}
catch (e) {

    console.error("Final save failed", e);

}

});
(function chromeSessionFix() {

    function syncUser() {
        try {

            const raw = sessionStorage.getItem("currentUser");
            if (!raw) return;

            const user = JSON.parse(raw);
            if (!user || !user.username) return;

            // 🔥 هذا هو السطر الذي تقصده
      Object.defineProperty(window, "currentUser", {
    get() {
        return window._cu || null;
    },
    set(v) {
        window._cu = v;
    }
});
window.currentUser = user;

            console.log("Session synced");

        } catch (e) {
            console.error(e);
        }
    }

    window.addEventListener("load", function () {
        setTimeout(syncUser, 300);
    });

})();
