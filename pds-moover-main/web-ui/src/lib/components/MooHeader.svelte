<script lang="ts">
    import cowPicture from '$lib/assets/moo.webp'

    let {title, customImg = null} = $props();

</script>


<div>
    <h1>{ title }</h1>
    <div class="cow-image">
        {#if customImg === null }
            <img src={cowPicture} alt="Cartoon milk cow"
                 style="max-width: 100%; max-height: 100%; object-fit: contain;">
        {:else}
            {@render customImg()}
        {/if}
    </div>
    <div class="made-by-blur">Made by <a href="https://bsky.app/profile/baileytownsend.dev">@baileytownsend.dev</a>
    </div>
    <div class="support-buttons">
        <span class="kofi-slot">
            <a href='https://ko-fi.com/T6T61FYPX' target='_blank'><img height='36' style='border:0px;height:36px;'
                                                                       src='https://storage.ko-fi.com/cdn/kofi1.png?v=6'
                                                                       border='0'
                                                                       alt='Buy Me a Coffee at ko-fi.com'/></a>
        </span>
        <iframe src="https://github.com/sponsors/fatfingers23/button" title="Sponsor fatfingers23" height="32"
                width="114" style="border: 0; border-radius: 6px;"></iframe>
    </div>
</div>