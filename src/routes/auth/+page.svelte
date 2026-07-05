<script lang="ts">
  import { authStore } from "$lib/stores/auth.svelte";
  import { authLogger } from "$lib/authLogger";
  import { uiStore } from "$lib/stores/ui.svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";

  let email = $state("");
  let otpCode = $state("");
  let authStep = $state<"request" | "verify">("request"); // 'request' or 'verify'
  let errorMsg = $state("");
  let loading = $state(false);
  let resendCooldown = $state(0);
  let cooldownTimer: any;

  $effect(() => {
    // If user is already authenticated in Supabase, redirect to account or target page
    if (authStore.user && !loading) {
      const redirectUrl = $page.url.searchParams.get("redirect") || "/account";
      authLogger.info(`User already authenticated, redirecting to ${redirectUrl}`);
      goto(redirectUrl);
    }
  });

  function startCooldown() {
    resendCooldown = 30;
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      if (resendCooldown > 0) {
        resendCooldown -= 1;
      } else {
        clearInterval(cooldownTimer);
      }
    }, 1000);
  }

  async function handleSendMagicLink() {
    if (!email.trim() || !email.includes("@")) {
      errorMsg = "Please enter a valid email address";
      return;
    }

    loading = true;
    errorMsg = "";
    authLogger.info("Requesting Supabase Login Code/Link...", { email });

    try {
      const result = await authStore.signInWithOtp(email.trim());
      if (result.error) {
        errorMsg = result.error;
        console.error(
          "[Auth Page] signInWithOtp returned error:",
          result.error,
        );
      } else {
        uiStore.addToast("Login link & verification code sent! 📩", "success");
        authStep = "verify";
        startCooldown();
      }
    } catch (err) {
      errorMsg =
        err instanceof Error ? err.message : "Failed to send login details";
      console.error("[Auth Page] signInWithOtp caught exception:", err);
    } finally {
      loading = false;
    }
  }

  async function handleVerifyOtp() {
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      errorMsg = "Please enter a 6-digit verification code";
      return;
    }

    loading = true;
    errorMsg = "";
    authLogger.info("Verifying Supabase OTP code...", { email });

    try {
      const result = await authStore.verifyOtp(email.trim(), otpCode.trim());
      if (result.error) {
        errorMsg = result.error;
        console.error("[Auth Page] verifyOtp returned error:", result.error);
      } else {
        uiStore.addToast("Welcome back! 🌸", "success");
        // Redirection is handled automatically by the $effect listening to authStore.user
      }
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : "Verification failed";
      console.error("[Auth Page] verifyOtp caught exception:", err);
    } finally {
      loading = false;
    }
  }

  async function handleResendMagicLink() {
    if (resendCooldown > 0) return;
    await handleSendMagicLink();
  }

  function handleGoBack() {
    authStep = "request";
    otpCode = "";
    errorMsg = "";
  }
</script>

<svelte:head>
  <title>Login or Sign Up — French Toes</title>
</svelte:head>

<div
  class="min-h-screen flex items-center justify-center px-4 py-12"
  style="background: var(--color-cream);"
>
  <div class="w-full max-w-md">
    <!-- Logo -->
    <div class="text-center mb-8">
      <a href="/" class="inline-flex items-center gap-2 mb-6">
        <img src="/images/logo-bird-brand.png" alt="French Toes Logo" class="w-10 h-10 object-contain" />
        <span
          class="font-display text-2xl font-semibold"
          style="color: var(--color-text-dark);">French Toes</span
        >
      </a>
      <h1
        class="font-display text-3xl font-bold"
        style="color: var(--color-text-dark);"
      >
        {#if authStep === "request"}
          Login or Sign Up
        {:else}
          Verify Your Login
        {/if}
      </h1>
      <p class="mt-2 text-sm" style="color: var(--color-text-soft);">
        {#if authStep === "request"}
          Secure passwordless login with standard Supabase Auth
        {:else}
          We sent a link & 6-digit code to your inbox
        {/if}
      </p>
    </div>

    <!-- Card -->
    <div
      class="bg-white rounded-3xl p-8 shadow-lg flex flex-col"
      style="box-shadow: 0 8px 40px rgba(180,100,140,0.12);"
    >
      <!-- Error Message -->
      {#if errorMsg}
        <div
          class="w-full mb-5 px-4 py-3 rounded-xl text-sm font-medium animate-pulse"
          style="background: #fde8e8; color: var(--color-coral-deep);"
        >
          {errorMsg}
        </div>
      {/if}

      {#if authStep === "request"}
        <!-- Phase 1: Request OTP/Magic Link -->
        <form
          onsubmit={(e) => {
            e.preventDefault();
            handleSendMagicLink();
          }}
          class="flex flex-col gap-5"
        >
          <div class="flex flex-col gap-2">
            <label
              for="email-input"
              class="text-xs font-bold uppercase tracking-wider text-[#6b4c6e]"
              >Email Address</label
            >
            <input
              id="email-input"
              type="email"
              bind:value={email}
              disabled={loading}
              placeholder="e.g. hello@frenchtoes.in"
              required
              class="w-full px-4 py-3.5 rounded-xl border text-sm bg-[#faf6f0]/50 outline-none transition-all focus:border-[#D81B60] focus:bg-white"
              style="border-color: var(--color-blush); color: var(--color-text-dark);"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            class="w-full py-4 rounded-full text-sm font-bold text-white transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
            style="background: var(--color-brand-magenta); opacity: {loading
              ? 0.7
              : 1}; cursor: {loading ? 'not-allowed' : 'pointer'};"
          >
            {#if loading}
              <div
                class="w-5 h-5 border-2 border-solid border-white border-t-transparent rounded-full animate-spin"
              ></div>
              Sending Secure Link...
            {:else}
              Send Login Link ✨
            {/if}
          </button>
        </form>
      {:else}
        <!-- Phase 2: Verify OTP or Link -->
        <form
          onsubmit={(e) => {
            e.preventDefault();
            handleVerifyOtp();
          }}
          class="flex flex-col gap-5"
        >
          <div class="flex flex-col gap-2">
            <div class="flex justify-between items-center">
              <label
                for="otp-input"
                class="text-xs font-bold uppercase tracking-wider text-[#6b4c6e]"
                >Verification Code</label
              >
              <button
                type="button"
                onclick={handleGoBack}
                class="text-xs font-semibold hover:underline"
                style="color: var(--color-brand-magenta);"
              >
                Change Email
              </button>
            </div>
            <input
              id="otp-input"
              type="text"
              maxlength="6"
              inputmode="numeric"
              pattern="[0-9]*"
              bind:value={otpCode}
              disabled={loading}
              placeholder="123456"
              required
              class="w-full px-4 py-3.5 rounded-xl border text-center text-lg font-mono tracking-widest bg-[#faf6f0]/50 outline-none transition-all focus:border-[#D81B60] focus:bg-white"
              style="border-color: var(--color-blush); color: var(--color-text-dark);"
            />
            <p
              class="text-[11px] text-center mt-2 leading-relaxed"
              style="color: var(--color-text-soft);"
            >
              Click the link in the email sent to <span
                class="font-semibold"
                style="color: var(--color-text-dark);">{email}</span
              > to log in instantly, or enter the 6-digit code above.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            class="w-full py-4 rounded-full text-sm font-bold text-white transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
            style="background: var(--color-brand-magenta); opacity: {loading
              ? 0.7
              : 1}; cursor: {loading ? 'not-allowed' : 'pointer'};"
          >
            {#if loading}
              <div
                class="w-5 h-5 border-2 border-solid border-white border-t-transparent rounded-full animate-spin"
              ></div>
              Verifying...
            {:else}
              Verify & Sign In 🌸
            {/if}
          </button>

          <!-- Resend Cooldown -->
          <div class="text-center mt-2">
            {#if resendCooldown > 0}
              <p class="text-xs" style="color: var(--color-text-soft);">
                Resend code in <span class="font-bold text-[#6b4c6e]"
                  >{resendCooldown}s</span
                >
              </p>
            {:else}
              <button
                type="button"
                onclick={handleResendMagicLink}
                class="text-xs font-bold hover:underline"
                style="color: var(--color-brand-magenta);"
              >
                Didn't receive the email? Resend Link & Code 📩
              </button>
            {/if}
          </div>
        </form>
      {/if}

      <p
        class="text-xs text-center mt-6"
        style="color: var(--color-text-soft);"
      >
        By continuing you agree to our <a
          href="/terms"
          class="underline"
          style="color: var(--color-brand-magenta);">terms</a
        >
        &
        <a
          href="/privacy"
          class="underline"
          style="color: var(--color-brand-magenta);">privacy policy</a
        >.
      </p>
    </div>

    <!-- Back link -->
    <p class="text-center mt-6 text-sm" style="color: var(--color-text-soft);">
      <a href="/shop" class="hover:underline"
        >← Continue shopping without account</a
      >
    </p>
  </div>
</div>
