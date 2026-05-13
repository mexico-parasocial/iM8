<script lang="ts">
    import favicon from '$lib/assets/moo.webp';
    import '$lib/assets/style.css'
    import NavBar from '$lib/components/NavBar.svelte';

    let {children} = $props();


</script>

<svelte:head>
    <link rel="icon" href={favicon}/>
</svelte:head>


<NavBar/>

<main class="page-content">
    {@render children?.()}
</main>