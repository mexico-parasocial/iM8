<script lang="ts">
	let { size = 16, className = '' }: { size?: number; className?: string } = $props();
</script>

<svg
	class="spinner {className}"
	viewBox="0 0 24 24"
	style="display: inline-block; width: {size}px; height: {size}px; margin-right: 8px;"
>
	<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.25" />
	<path
		d="M12 2 A10 10 0 0 1 22 12"
		stroke="currentColor"
		stroke-width="3"
		fill="none"
		stroke-linecap="round"
	>
		<animateTransform
			attributeName="transform"
			type="rotate"
			from="0 12 12"
			to="360 12 12"
			dur="1s"
			repeatCount="indefinite"
		/>
	</path>
</svg>
