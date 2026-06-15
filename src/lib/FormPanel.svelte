<script>
	import { store } from '$lib/store.svelte.js';
	import { MATTER_STATES } from '$lib/enums.js';
	import EnumSelect from '$lib/EnumSelect.svelte';

	let blank = () => ({ id: '', matter_state: '' });
	let form = $state(blank());
	let error = $state('');

	let editId = $state(null);
	let editDraft = $state({});
	let deleteId = $state(null);

	function validId(id) { return /^[a-z0-9_]+$/.test(id); }

	function idConflict(id, excludeId = null) {
		return store.forms.some((f) => f.id !== excludeId && f.id === id);
	}

	function add() {
		if (!form.id.trim()) { error = 'ID is required'; return; }
		if (!validId(form.id)) { error = 'ID must be lowercase letters, numbers, or underscores only'; return; }
		if (!form.matter_state) { error = 'Matter state is required'; return; }
		if (idConflict(form.id)) { error = `Form "${form.id}" already exists`; return; }
		store.addForm({ id: form.id, matter_state: form.matter_state });
		form = blank();
		error = '';
	}

	function startEdit(f) {
		editId = f.id;
		editDraft = { ...f };
		deleteId = null;
	}

	function saveEdit() {
		if (!editDraft.id.trim() || !validId(editDraft.id)) return;
		store.updateForm(editId, editDraft);
		editId = null;
	}

	function cancelEdit() { editId = null; }
	function confirmDelete(id) { deleteId = id; editId = null; }
	function doDelete(id) { store.deleteForm(id); deleteId = null; }
	function cancelDelete() { deleteId = null; }
</script>

<div class="space-y-6">
	<div class="bg-white border border-gray-200 rounded-lg p-4">
		<h3 class="text-sm font-semibold text-gray-700 mb-3">Add Ingredient Form</h3>
		<div class="grid grid-cols-2 gap-3 mb-3">
			<div>
				<label class="block text-xs text-gray-500 mb-1">
					ID
					<span class="text-gray-400 font-normal">(lowercase, underscores)</span>
				</label>
				<input
					bind:value={form.id}
					placeholder="e.g. semolina"
					onkeydown={(e) => e.key === 'Enter' && add()}
					class="border border-gray-300 rounded px-2 py-1.5 text-sm w-full font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
				/>
			</div>
			<div>
				<label class="block text-xs text-gray-500 mb-1">Matter State</label>
				<EnumSelect
					options={MATTER_STATES}
					customOptions={store.customMatterStates}
					value={form.matter_state}
					placeholder="Select state…"
					onchange={(v) => (form.matter_state = v)}
					onAddCustom={(v) => store.addCustomMatterState(v)}
				/>
			</div>
		</div>
		{#if error}
			<p class="text-red-500 text-xs mb-2">{error}</p>
		{/if}
		<button onclick={add} class="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium">
			Add Form
		</button>
	</div>

	{#if store.forms.length}
		<div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
			<table class="w-full text-sm">
				<thead class="bg-gray-50 border-b border-gray-200">
					<tr>
						<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
						<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Matter State</th>
						<th class="px-4 py-2"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each store.forms as f (f.id)}
						{#if editId === f.id}
							<tr class="bg-teal-50">
								<td class="px-3 py-2">
									<input
										bind:value={editDraft.id}
										class="border border-gray-300 rounded px-2 py-1 text-sm font-mono w-full"
									/>
								</td>
								<td class="px-3 py-2">
									<EnumSelect
										options={MATTER_STATES}
										customOptions={store.customMatterStates}
										value={editDraft.matter_state}
										onchange={(v) => (editDraft.matter_state = v)}
										onAddCustom={(v) => store.addCustomMatterState(v)}
									/>
								</td>
								<td class="px-3 py-2 whitespace-nowrap">
									<button onclick={saveEdit} class="text-teal-700 hover:text-teal-900 font-medium text-xs mr-2">Save</button>
									<button onclick={cancelEdit} class="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
								</td>
							</tr>
						{#if deleteId === f.id}
							<tr class="bg-red-50">
								<td colspan="2" class="px-4 py-2 text-sm text-red-700">
									Delete <strong>{f.id}</strong>?
									{#if store.relations.some(r => r.form === f.id || r.origin === f.id || r.base === f.id || r.variety === f.id)}
										<span class="block text-xs font-semibold mt-1">
											Warning: This will also remove {store.relations.filter(r => r.form === f.id || r.origin === f.id || r.base === f.id || r.variety === f.id).length} related entries from the Relations tab.
										</span>
									{/if}
								</td>
								<td class="px-3 py-2 whitespace-nowrap">
									<button onclick={() => doDelete(f.id)} class="text-red-600 hover:text-red-800 font-medium text-xs mr-2">Delete</button>
									<button onclick={cancelDelete} class="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
								</td>
							</tr>
						{:else}
							<tr class="hover:bg-gray-50">
								<td class="px-4 py-2 font-mono font-medium">{f.id}</td>
								<td class="px-4 py-2 text-gray-600">
									{f.matter_state}
									{#if store.customMatterStates.includes(f.matter_state)}
										<span class="ml-1 text-xs text-teal-600">✦</span>
									{/if}
								</td>
								<td class="px-4 py-2 whitespace-nowrap text-right">
									<button onclick={() => startEdit(f)} class="text-gray-400 hover:text-teal-700 text-xs mr-3">Edit</button>
									<button onclick={() => confirmDelete(f.id)} class="text-gray-400 hover:text-red-600 text-xs">Delete</button>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="text-sm text-gray-400 text-center py-6">No forms yet.</p>
	{/if}
</div>
