import { browser } from '$app/environment';

const LS_KEY = 'ifid_state';
const IDB_DB = 'ifid';
const IDB_STORE = 'state';

function idbOpen() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(IDB_DB, 1);
		req.onupgradeneeded = (e) => e.target.result.createObjectStore(IDB_STORE);
		req.onsuccess = (e) => resolve(e.target.result);
		req.onerror = () => reject(req.error);
	});
}

async function idbGet() {
	try {
		const db = await idbOpen();
		return new Promise((resolve) => {
			const tx = db.transaction(IDB_STORE, 'readonly');
			const req = tx.objectStore(IDB_STORE).get('current');
			req.onsuccess = () => resolve(req.result ?? null);
			req.onerror = () => resolve(null);
		});
	} catch { return null; }
}

async function idbSet(val) {
	try {
		const db = await idbOpen();
		const tx = db.transaction(IDB_STORE, 'readwrite');
		tx.objectStore(IDB_STORE).put(val, 'current');
	} catch { /* silent */ }
}

class IFIDStore {
	sources = $state([]);
	forms = $state([]);
	relations = $state([]);
	customMethods = $state([]);
	customMatterStates = $state([]);
	customSourceTypes = $state([]);

	async init() {
		if (!browser) return;
		let data = null;
		try { data = JSON.parse(localStorage.getItem(LS_KEY)); } catch { /* */ }
		if (!data) data = await idbGet();
		if (data) this.#apply(data);
	}

	#apply(data) {
		this.sources = data.sources ?? [];
		this.forms = data.forms ?? [];
		this.relations = data.relations ?? [];
		this.customMethods = data.customMethods ?? [];
		this.customMatterStates = data.customMatterStates ?? [];
		this.customSourceTypes = data.customSourceTypes ?? [];
	}

	#snap() {
		return {
			sources: this.sources,
			forms: this.forms,
			relations: this.relations,
			customMethods: this.customMethods,
			customMatterStates: this.customMatterStates,
			customSourceTypes: this.customSourceTypes
		};
	}

	#persist() {
		if (!browser) return;
		const snap = this.#snap();
		localStorage.setItem(LS_KEY, JSON.stringify(snap));
		idbSet(snap);
	}

	loadState(state) {
		this.#apply(state);
		this.#persist();
	}

	snapshot() {
		return this.#snap();
	}

	// Custom enum values
	addCustomMethod(v) {
		if (!this.customMethods.includes(v)) {
			this.customMethods = [...this.customMethods, v];
			this.#persist();
		}
	}
	addCustomMatterState(v) {
		if (!this.customMatterStates.includes(v)) {
			this.customMatterStates = [...this.customMatterStates, v];
			this.#persist();
		}
	}
	addCustomSourceType(v) {
		if (!this.customSourceTypes.includes(v)) {
			this.customSourceTypes = [...this.customSourceTypes, v];
			this.#persist();
		}
	}

	// Sources
	addSource(s) {
		this.sources = [...this.sources, { id: crypto.randomUUID(), ...s }];
		this.#persist();
	}
	updateSource(id, updates) {
		this.sources = this.sources.map((s) => (s.id === id ? { ...s, ...updates } : s));
		this.#persist();
	}
	deleteSource(id) {
		this.sources = this.sources.filter((s) => s.id !== id);
		this.relations = this.relations.filter((r) => {
			if (r.type === 'FormOf') return r.origin !== id;
			if (r.type === 'VarietyOf') return r.base !== id && r.variety !== id;
			return true;
		});
		this.#persist();
	}

	// Forms
	addForm(f) {
		this.forms = [...this.forms, { ...f }];
		this.#persist();
	}
	updateForm(id, updates) {
		this.forms = this.forms.map((f) => (f.id === id ? { ...f, ...updates } : f));
		this.#persist();
	}
	deleteForm(id) {
		this.forms = this.forms.filter((f) => f.id !== id);
		this.relations = this.relations.filter((r) => r.type !== 'FormOf' || r.form !== id);
		this.#persist();
	}

	// Relations
	addRelation(r) {
		this.relations = [...this.relations, { id: crypto.randomUUID(), ...r }];
		this.#persist();
	}
	updateRelation(id, updates) {
		this.relations = this.relations.map((r) => (r.id === id ? { ...r, ...updates } : r));
		this.#persist();
	}
	deleteRelation(id) {
		this.relations = this.relations.filter((r) => r.id !== id);
		this.#persist();
	}
}

export const store = new IFIDStore();
