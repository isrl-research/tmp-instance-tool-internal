import { SOURCE_TYPES, MATTER_STATES, PROCESSING_METHODS } from './enums.js';

function toVar(name) {
	return name
		.toLowerCase()
		.replace(/\s+/g, '_')
		.replace(/[^a-z0-9_]/g, '');
}

function topoSort(nodes, relations) {
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
		const n = nodes.find((n) => n.id === id);
		if (n) out.push(n);
	}

	nodes.forEach((n) => visit(n.id));
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

	const varMap = {};
	sources.forEach((s) => { varMap[s.id] = toVar(s.name); });
	forms.forEach((f) => { varMap[f.id] = toVar(f.id); });

	// Unified list for topoSort
	const allNodes = [
		...sources.map(s => ({ ...s, _kind: 'source' })),
		...forms.map(f => ({ ...f, _kind: 'form' }))
	];

	const sorted = topoSort(allNodes, relations);
...
	L.push('db = Database()');
	L.push('');

	if (sorted.length) {
		sorted.forEach((node) => {
			const v = varMap[node.id];
			if (node._kind === 'form') {
				const flag = customMatterStates.includes(node.matter_state) ? '  # NEW matter_state' : '';
				L.push(`${v} = db.add(IngredientForm(id="${node.id}", matter_state="${node.matter_state}"))${flag}`);
			} else {
				const typeFlag = customSourceTypes.includes(node.type) ? '  # NEW source_type' : '';
				L.push(`${v} = db.add(Source(`);
				L.push(`    name="${node.name}",`);
				L.push(`    type="${node.type}",${typeFlag}`);
				L.push(`    is_allergen=${node.is_allergen ? 'True' : 'False'},`);
				L.push(`    is_declarable=${node.is_declarable ? 'True' : 'False'}`);
				L.push('))');
			}

			// Relations where this node is the child/origin
			relations
				.filter((r) => r.type === 'VarietyOf' && r.variety === node.id)
				.forEach((r) => {
					const bv = varMap[r.base];
					const sv = varMap[r.variety];
					if (bv && sv) L.push(`db.relate(VarietyOf(base=${bv}, variety=${sv}))`);
				});

			relations
				.filter((r) => r.type === 'FormOf' && r.origin === node.id)
				.forEach((r) => {
					const ov = varMap[r.origin];
					const fv = varMap[r.form];
					if (!ov || !fv) return;
					const methods = (r.processing_methods ?? []).map((m) => `"${m}"`).join(', ');
					const hasNew = (r.processing_methods ?? []).some((m) => customMethods.includes(m));
					const flag = hasNew ? '  # NEW processing_method' : '';
					L.push(`db.relate(FormOf(origin=${ov}, form=${fv}, processing_method=[${methods}]))${flag}`);
				});

			L.push('');
		});
	}

	L.push('print(db)');
	return L.join('\n');
}
