<script>
	import { store } from '$lib/store.svelte.js';
	import { SOURCE_TYPES } from '$lib/enums.js';
	import EnumSelect from '$lib/EnumSelect.svelte';

	let blank = () => ({ name: '', type: '', is_allergen: false, is_declarable: false });
	let form = $state(blank());
	let error = $state('');

	let editId = $state(null);
	let editDraft = $state({});
	let deleteId = $state(null);

	function nameConflict(name, excludeId = null) {
		return store.sources.some((s) => s.id !== excludeId && s.name.trim().toLowerCase() === name.trim().toLowerCase());
	}

	function add() {
		if (!form.name.trim()) { error = 'Name is required'; return; }
		if (!form.type) { error = 'Type is required'; return; }
		if (nameConflict(form.name)) { error = 'A source with this name already exists'; return; }
		store.addSource({ name: form.name.trim(), type: form.type, is_allergen: form.is_allergen, is_declarable: form.is_declarable });
		form = blank();
		error = '';
	}

	function startEdit(s) {
		editId = s.id;
		editDraft = { ...s };
		deleteId = null;
	}

	function saveEdit() {
		if (!editDraft.name.trim()) return;
		if (nameConflict(editDraft.name, editId)) { return; }
		store.updateSource(editId, editDraft);
		editId = null;
	}

	function cancelEdit() { editId = null; }

	function confirmDelete(id) { deleteId = id; editId = null; }
	function doDelete(id) { store.deleteSource(id); deleteId = null; }
	function cancelDelete() { deleteId = null; }
</script>

<div class="space-y-6">
	<!-- Add form -->
	<div class="bg-white border border-gray-200 rounded-lg p-4">
		<h3 class="text-sm font-semibold text-gray-700 mb-3">Add Source</h3>
		<div class="grid grid-cols-2 gap-3 mb-3">
			<div>
				<label class="block text-xs text-gray-500 mb-1">Name</label>
				<input
					bind:value={form.name}
					placeholder="e.g. whole milk"
					onkeydown={(e) => e.key === 'Enter' && add()}
					class="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-teal-500"
				/>
			</div>
			<div>
				<label class="block text-xs text-gray-500 mb-1">Type</label>
				<EnumSelect
					options={SOURCE_TYPES}
					customOptions={store.customSourceTypes}
					value={form.type}
					placeholder="Select type…"
					onchange={(v) => (form.type = v)}
					onAddCustom={(v) => store.addCustomSourceType(v)}
				/>
			</div>
		</div>
		<div class="flex gap-6 mb-3">
			<label class="flex items-center gap-2 text-sm cursor-pointer">
				<input type="checkbox" bind:checked={form.is_allergen} class="accent-teal-600" />
				Allergen
			</label>
			<label class="flex items-center gap-2 text-sm cursor-pointer">
				<input type="checkbox" bind:checked={form.is_declarable} class="accent-teal-600" />
				Declarable
			</label>
		</div>
		{#if error}
			<p class="text-red-500 text-xs mb-2">{error}</p>
		{/if}
		<button onclick={add} class="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium">
			Add Source
		</button>
	</div>

	<!-- List -->
	{#if store.sources.length}
		<div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
			<table class="w-full text-sm">
				<thead class="bg-gray-50 border-b border-gray-200">
					<tr>
						<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
						<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
						<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Allergen</th>
						<th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Declarable</th>
						<th class="px-4 py-2"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each store.sources as s (s.id)}
						{#if editId === s.id}
							<tr class="bg-teal-50">
								<td class="px-3 py-2">
									<input bind:value={editDraft.name} class="border border-gray-300 rounded px-2 py-1 text-sm w-full" />
								</td>
								<td class="px-3 py-2">
									<EnumSelect
										options={SOURCE_TYPES}
										customOptions={store.customSourceTypes}
										value={editDraft.type}
										onchange={(v) => (editDraft.type = v)}
										onAddCustom={(v) => store.addCustomSourceType(v)}
									/>
								</td>
								<td class="px-3 py-2 text-center">
									<input type="checkbox" bind:checked={editDraft.is_allergen} class="accent-teal-600" />
								</td>
								<td class="px-3 py-2 text-center">
									<input type="checkbox" bind:checked={editDraft.is_declarable} class="accent-teal-600" />
								</td>
								<td class="px-3 py-2 whitespace-nowrap">
									<button onclick={saveEdit} class="text-teal-700 hover:text-teal-900 font-medium text-xs mr-2">Save</button>
									<button onclick={cancelEdit} class="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
								</td>
							</tr>
						{#if deleteId === s.id}
							<tr class="bg-red-50">
								<td colspan="4" class="px-4 py-2 text-sm text-red-700">
									Delete <strong>{s.name}</strong>?
									{#if store.relations.some(r => r.origin === s.id || r.base === s.id || r.variety === s.id)}
										<span class="block text-xs font-semibold mt-1">
											Warning: This will also remove {store.relations.filter(r => r.origin === s.id || r.base === s.id || r.variety === s.id || (r.type === 'FormOf' && r.form === s.id)).length} related entries from the Relations tab.
										</span>
									{/if}
								</td>
								<td class="px-3 py-2 whitespace-nowrap">
									<button onclick={() => doDelete(s.id)} class="text-red-600 hover:text-red-800 font-medium text-xs mr-2">Delete</button>
									<button onclick={cancelDelete} class="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
								</td>
							</tr>
						{:else}
							<tr class="hover:bg-gray-50">
								<td class="px-4 py-2 font-medium">
									{s.name}
									{#if store.customSourceTypes.includes(s.type)}
										<span class="ml-1 text-xs text-teal-600">✦</span>
									{/if}
								</td>
								<td class="px-4 py-2 text-gray-600">{s.type}</td>
								<td class="px-4 py-2 text-center">{s.is_allergen ? '✓' : '—'}</td>
								<td class="px-4 py-2 text-center">{s.is_declarable ? '✓' : '—'}</td>
								<td class="px-4 py-2 whitespace-nowrap text-right">
									<button onclick={() => startEdit(s)} class="text-gray-400 hover:text-teal-700 text-xs mr-3">Edit</button>
									<button onclick={() => confirmDelete(s.id)} class="text-gray-400 hover:text-red-600 text-xs">Delete</button>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="text-sm text-gray-400 text-center py-6">No sources yet.</p>
	{/if}
</div>
