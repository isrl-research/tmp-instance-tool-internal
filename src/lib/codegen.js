import { SOURCE_TYPES, MATTER_STATES, PROCESSING_METHODS } from './enums.js';

function toVar(name) {
	return name
		.toLowerCase()
		.replace(/\s+/g, '_')
		.replace(/[^a-z0-9_]/g, '');
}

function topoSort(sources, relations) {
	const parentOf = {};
	relations
		.filter((r) => r.type === 'VarietyOf')
		.forEach((r) => { parentOf[r.variety] = r.base; });

	const visited = new Set();
	const out = [];

	function visit(id) {
		if (visited.has(id)) return;
		visited.add(id);
		if (parentOf[id]) visit(parentOf[id]);
		const s = sources.find((s) => s.id === id);
		if (s) out.push(s);
	}

	sources.forEach((s) => visit(s.id));
	return out;
}

export function generatePython(state) {
	const {
		sources = [],
		forms = [],
		relations = [],
		customMethods = [],
		customMatterStates = [],
		customSourceTypes = []
	} = state;

	const sourceVars = {};
	sources.forEach((s) => { sourceVars[s.id] = toVar(s.name); });

	const formVars = {};
	forms.forEach((f) => { formVars[f.id] = toVar(f.id); });

	const sorted = topoSort(sources, relations);

	// Collect custom values actually in use
	const usedCustomMethods = new Set();
	const usedCustomMatterStates = new Set();
	const usedCustomSourceTypes = new Set();

	relations.forEach((r) => {
		if (r.type === 'FormOf') {
			(r.processing_methods ?? []).forEach((m) => {
				if (customMethods.includes(m)) usedCustomMethods.add(m);
			});
		}
	});
	forms.forEach((f) => {
		if (customMatterStates.includes(f.matter_state)) usedCustomMatterStates.add(f.matter_state);
	});
	sources.forEach((s) => {
		if (customSourceTypes.includes(s.type)) usedCustomSourceTypes.add(s.type);
	});

	const L = [];

	L.push(`# IFID_STATE: ${btoa(JSON.stringify(state))}`);
	L.push('');

	const hasCustom =
		usedCustomMethods.size || usedCustomMatterStates.size || usedCustomSourceTypes.size;
	if (hasCustom) {
		L.push('# ── New enum values — add these to enum_requests.md ──────────────────');
		usedCustomMethods.forEach((m) =>
			L.push(`# NEW  processing_method: "${m}"`)
		);
		usedCustomMatterStates.forEach((m) =>
			L.push(`# NEW  matter_state: "${m}"`)
		);
		usedCustomSourceTypes.forEach((m) =>
			L.push(`# NEW  source_type: "${m}"`)
		);
		L.push('# ─────────────────────────────────────────────────────────────────────');
		L.push('');
	}

	L.push('from index import Database, Source, IngredientForm, FormOf, VarietyOf');
	L.push('');
	L.push('db = Database()');
	L.push('');

	if (forms.length) {
		L.push('# Forms');
		forms.forEach((f) => {
			const v = formVars[f.id];
			const flag = customMatterStates.includes(f.matter_state) ? '  # NEW matter_state' : '';
			L.push(`${v} = db.add(IngredientForm(id="${f.id}", matter_state="${f.matter_state}"))${flag}`);
		});
		L.push('');
	}

	if (sorted.length) {
		L.push('# Sources & Relations');
		sorted.forEach((source) => {
			const sv = sourceVars[source.id];
			const typeFlag = customSourceTypes.includes(source.type) ? '  # NEW source_type' : '';
			L.push(`${sv} = db.add(Source(`);
			L.push(`    name="${source.name}",`);
			L.push(`    type="${source.type}",${typeFlag}`);
			L.push(`    is_allergen=${source.is_allergen ? 'True' : 'False'},`);
			L.push(`    is_declarable=${source.is_declarable ? 'True' : 'False'}`);
			L.push('))');

			relations
				.filter((r) => r.type === 'VarietyOf' && r.variety === source.id)
				.forEach((r) => {
					const bv = sourceVars[r.base];
					if (bv) L.push(`db.relate(VarietyOf(base=${bv}, variety=${sv}))`);
				});

			relations
				.filter((r) => r.type === 'FormOf' && r.origin === source.id)
				.forEach((r) => {
					const fv = formVars[r.form];
					if (!fv) return;
					const methods = (r.processing_methods ?? []).map((m) => `"${m}"`).join(', ');
					const hasNew = (r.processing_methods ?? []).some((m) => customMethods.includes(m));
					const flag = hasNew ? '  # NEW processing_method' : '';
					L.push(`db.relate(FormOf(origin=${sv}, form=${fv}, processing_method=[${methods}]))${flag}`);
				});

			L.push('');
		});
	}

	L.push('print(db)');
	return L.join('\n');
}
