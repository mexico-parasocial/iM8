<script lang="ts">
    import OgImage from '$lib/components/OgImage.svelte';
    import MooHeader from '$lib/components/MooHeader.svelte';
    import SignThePapersImg from '$lib/assets/sign_the_papers.png'
</script>

<svelte:head>
    <title>PDS MOOver - Info</title>
    <meta property="og:description" content="ATProto account migration tool"/>
    <OgImage/>
</svelte:head>

<div class="container">
    <MooHeader title="PDS MOOver Info"/>


    <div class="section" id="top">
        <p> This page is to help you decide if you want to use PDS MOOver to move your ATProto(Bluesky) account to a new
            PDS along with some other information about all the new tools.
            One way or the other. TLDR (You should still read the whole thing), at least read and follow the <a
                    href="#precautions">precautions section</a>.</p>


        <section class="section" style="text-align:left">
            <h2>Info</h2>
            <p>PDS MOOver is a set of tools to help you migrate to a new PDS. The creator
                or host of this tool will not be able to help you recover your account if something goes wrong. So be
                advised you and your PDS admin may be on your own besides helpful answers and understand the risk you
                take in doing an account movement.</p>
        </section>


        <nav aria-label="Table of contents" class="section" style="text-align:left">
            <h3>Table of contents</h3>
            <ol>
                <li><a href="#precautions">Precautions</a></li>
                <li><a href="#backups">Backups</a></li>
                <li><a href="#restore">Restore</a></li>
                <li><a href="#blacksky">I'm here for Blacksky, is there a video guide?</a></li>
                <li><a href="#cant-login">I can't log in?/Says my account is deactivated?</a></li>
                <li><a href="#invalid-handle">My account says Invalid Handle?</a></li>
                <li><a href="#help">!!!!!HELP!!!!!</a></li>
                <li><a href="#why">Why doesn't PDS MOOver have xyz?</a></li>
                <li><a href="#done">Alright account migrated, now what?</a></li>
                <li><a href="#slow">Why is it so SLOW?</a></li>
                <li><a href="#open-source">Can I check out the code anywhere?</a></li>
            </ol>
        </nav>

        <section id="precautions" class="section" style="text-align:left">
            <h2>Precautions</h2>
            <p> Migrations can be a potentially dangerous operation. It is recommended to follow these few steps to
                protect your account and identity.</p>
            <ul>
                <li>During migration make sure to do not leave the page</li>
                <li>It is recommended to use a desktop computer for this process due to the amount of time it can
                    take.
                </li>
                <li>Your account is not actually fully moved over to the new PDS till you receive a code in your email
                    and enter it on PDS MOOver, this is the final step.
                </li>
                <li>Your data will not be deleted from Bluesky(or your previous PDS) during migration. If you find you
                    are missing any pictures or videos after the move you can use the <a href="/missing-blobs">Missing
                        tool</a> to recover those from your previous PDS.
                </li>
            </ul>

            <p>At the end of your migration and before you move you will be asked if you'd like to sign up for PDS
                MOOver's backup service and to add a rotation key. Both of these are recommended and secure your account
                if your PDS ever goes down, allowing for account recovery. </p>
            <img src="{SignThePapersImg}" alt="Sign the papers"
                 style="max-width: 100%; max-height: 100%; object-fit: contain;">

        </section>

        <section id="backups" class="section" style="text-align:left">
            <h2>Backups</h2>
            <p>PDS MOOver now supports backups. These are automated backups of your account saving your repo
                (posts,likes,etc), and your blobs(picture/videos) from your AT Proto account to a cloud base object
                store (S3). This is a free service for individual accounts and stores the backups on PDS MOOver's
                servers. These backups will happen every 2 hours from the time you sign up. We are expecting to lower
                this as we see how the service does. On login, you will be asked if you'd like to add a rotation key to
                your account. It is highly recommended to do this if you do not already have one. This is the only way
                you can recover your account in the event of a PDS failure or rogue account takeover</p>

            <p>Just like your <a target="_blank" rel="noopener noreferrer"
                                 href="https://blueskyweb.zendesk.com/hc/en-us/articles/15835264007693-Data-Privacy">AT
                Proto data</a>, your backedup data is also public.
                You can access your data much the same way you do on your PDS by calling these endpoints. Since these
                behave much the same as the PDS they are public.
            </p>
            <ul>
                <li><code>/xrpc/com.atproto.sync.getRepo?did="your did"</code> to get a copy of your repo's CAR export
                </li>
                <li><code>/xrpc/com.atproto.sync.getBlob?did="your did"&cid="cid of the blob"</code></li>
            </ul>

        </section>

        <section id="restore" class="section" style="text-align:left">
            <h2>Restore</h2>
            <p>Backups without a restore option aren't very good backups. So to pair well with our new backup service
                PDS MOOver now also offers recovery of your account and restoring from a backup. To use this you must
                have your Private Rotation Key. You can add one to your account either after migration or during backups
                sign up. This recovery process follows much the same process as out line in <a
                        href="https://www.da.vidbuchanan.co.uk/blog/adversarial-pds-migration.html">Adversarial ATProto
                    PDS Migration</a> blog post by <a href="https://bsky.app/profile/retr0.id">@retr0.id</a>. </p>
        </section>

        <section id="blacksky" class="section" style="text-align:left">
            <h2>I'm here for Blacksky, Is there a video guide?</h2>
            <p>
                <a href="https://blacksky.community/profile/did:plc:g7j6qok5us4hjqlwjxwrrkjm">@sharpiepls.com</a> has
                made an amazing video guide on
                how to use PDS MOOver to move your bluesky account to blacksky.app.
                <video width="100%" controls>

                    <source src="https://blacksky.app/xrpc/com.atproto.sync.getBlob?did=did:plc:g7j6qok5us4hjqlwjxwrrkjm&cid=bafkreielhdoa2lcyiat5oumkbkwy26hlj36rwwwfi5fbnvd5haxq3t4joa"/>
                </video>
            </p>
        </section>

        <section id="cant-login" class="section" style="text-align:left">
            <h2>I can't log in?/Says my account is deactivated?</h2>
            <p>When you move to a non Bluesky PDS you have to do an extra step on login.</p>
            <ol>
                <li>On the Sign in screen for <a href="https://bsky.app">bsky.app</a> or on the app click the top input
                    titled "Hosting provider" and has a globe icon and says Bluesky Social"
                </li>
                <li>Click the tab labeled custom</li>
                <li>In the input for server address you put the same URL you used for the new PDS URL with the https://
                    like so <code>https://example.com</code></li>
                <li>Click done and enter your new handle(or email) and password</li>
            </ol>
        </section>

        <section id="invalid-handle" class="section" style="text-align:left">
            <h2>My account says Invalid Handle?</h2>
            <p>It's a bit of a bug sometimes. I'm not sure what causes it, but usually mentioning your handle in a post
                or reply fixes it.
                Like <code>@fullhandle.newpds.com</code>, may or may not highlight it blue and autofill it but make sure
                you have the
                full handle and the @ like that. Can also check your handle with the <a
                        href="https://bsky-debug.app/handle">Bluesky Debug Page</a>. If you see green, and it says one
                of
                them pass you should be fine and just may take a while to update.</p>
        </section>

        <section id="help" class="section" style="text-align:left">
            <h2>!!!!!HELP!!!!!</h2>
            <p>If you're having issues with PDS MOOver first of all, I'm very sorry. I have tested this to the best of
                my
                ability, but PDS migrations do come with risks. I would recommend getting with the owner of the PDS and
                seeing where the account stands with tools like <a href="https://pdsls.dev">pdsls</a>.</p>

            <p> The tool is designed to be able to be re ran IF you set the Advance Options flags.For example, lets say
                if it created the account, repo is there but some blobs are missing. You can uncheck everything but
                "Migrate Missing Blobs", "Migrate Prefs", and "Migrate PLC record" and it will pick up after the account
                repo migration. It is odd in the fact that all the fields are required. That's just to cut down on logic
                to hopefully cut down on bugs. If you don't ever see the "Please enter your PLC Token" and enter the
                token sent to your email, you can just
                forget about it and call it a day if it's too much. Your old account is still active and working.</p>
        </section>


        <section id="why" class="section" style="text-align:left">
            <h2>Why doesn't PDS MOOver have xyz for migrations?</h2>
            <p>PDS MOOver was designed to pretty much be the goat account migration with a UI. Like in this <a
                    href="https://whtwnd.com/bnewbold.net/3l5ii332pf32u"> post</a>. Keeping it simple and hard fails if
                anything
                goes wrong
                to
                hopefully cover most use cases.</p>
        </section>

        <section id="done" class="section" style="text-align:left">
            <h2>Alright account migrated, now what?</h2>
            <p>Welcome to your new PDS! You can login to your new PDS on Bluesky's login screen by selecting "Hosting
                provider" and entering your PDS url. I also recommend making sure you are signed up for our <a
                        href="/backups">backups</a> and have a recovery key that you control in case your PDS disappears
                overnight you can regain your account. </p>
        </section>

        <section id="slow" class="section" style="text-align:left">
            <h2>Why is it so SLOW?</h2>
            <p>Everything happens client side, and the blob uploads take a while. Nothing runs in parallel. Blob uploads
                happen one at a time; once one is done, the next goes. This is done just to keep it as simple as
                possible and to hopefully limit the chance of failures on uploads. My personal account takes about
                20-30ish mins to move with 1,700ish blobs at 800mb on a 1gig internet connection.</p>
        </section>

        <section id="open-source" class="section" style="text-align:left">
            <h2>Can I check out the code anywhere?</h2>
            <p>Yep! PDS MOOver is 100% open source and can find the code on <a
                    href="https://tangled.sh/@baileytownsend.dev/pds-moover">tangled.sh</a>. Also, if you're a
                developer,
                and you want to fork the code for a new UI. PDS MOOver's logic is all in one js file. Just take it and
                its dependencies and have at it.</p>
        </section>
    </div>

</div>
