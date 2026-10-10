<script lang="ts">
  import { onMount } from "svelte";
  import { authStore } from "$lib/stores/auth.svelte";
  import { authLogger } from "$lib/authLogger";
  import { uiStore } from "$lib/stores/ui.svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";

  const STORAGE_KEY_EMAIL = "ft_auth_pending_email";
  const STORAGE_KEY_STEP = "ft_auth_pending_step";
  const STORAGE_KEY_COOLDOWN = "ft_auth_cooldown_until";
  const STORAGE_KEY_TIME = "ft_auth_timestamp";

  let email = $state("");
  let password = $state("");
  let authMode = $state<"otp" | "password">("otp");
  let otpCode = $state("");
  let authStep = $state<"request" | "verify">("request");
  let errorMsg = $state("");
  let loading = $state(false);
  let resendCooldown = $state(0);
  let cooldownTimer: any;

  async function handlePasswordLogin() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      errorMsg = "Please enter email and password";
      return;
    }
    loading = true;
    errorMsg = "";
    try {
      const res = await authStore.signIn(cleanEmail, password);
      if (res.error) {
        errorMsg = res.error;
      } else {
        clearPersistedAuth();
        uiStore.addToast("Signed in successfully!", "success");
      }
    } catch (err: any) {
      errorMsg = err instanceof Error ? err.message : "Sign in failed";
    } finally {
      loading = false;
    }
  }

  function clearPersistedAuth() {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY_EMAIL);
        localStorage.removeItem(STORAGE_KEY_STEP);
        localStorage.removeItem(STORAGE_KEY_COOLDOWN);
        localStorage.removeItem(STORAGE_KEY_TIME);
      }
    } catch (_) {}
  }

  function persistAuthStep(targetEmail: string, cooldownSeconds: number = 30) {
    try {
      if (typeof window !== "undefined") {
        const cooldownUntil = Date.now() + cooldownSeconds * 1000;
        localStorage.setItem(STORAGE_KEY_EMAIL, targetEmail);
        localStorage.setItem(STORAGE_KEY_STEP, "verify");
        localStorage.setItem(STORAGE_KEY_COOLDOWN, String(cooldownUntil));
        localStorage.setItem(STORAGE_KEY_TIME, String(Date.now()));
      }
    } catch (_) {}
  }

  function startCooldown(seconds: number = 30) {
    resendCooldown = seconds;
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      if (resendCooldown > 0) {
        resendCooldown -= 1;
      } else {
        clearInterval(cooldownTimer);
      }
    }, 1000);
  }

  onMount(() => {
    try {
      if (typeof window !== "undefined") {
        const savedEmail = localStorage.getItem(STORAGE_KEY_EMAIL);
        const savedStep = localStorage.getItem(STORAGE_KEY_STEP);
        const savedTime = localStorage.getItem(STORAGE_KEY_TIME);
        const savedCooldown = localStorage.getItem(STORAGE_KEY_COOLDOWN);

        // Check if OTP was sent within the last 15 minutes
        if (savedEmail && savedStep === "verify" && savedTime) {
          const elapsedMs = Date.now() - Number(savedTime);
          if (elapsedMs < 15 * 60 * 1000) {
            email = savedEmail;
            authStep = "verify";

            if (savedCooldown) {
              const remainingSec = Math.max(
                0,
                Math.ceil((Number(savedCooldown) - Date.now()) / 1000),
              );
              if (remainingSec > 0) {
                startCooldown(remainingSec);
              }
            }
          } else {
            clearPersistedAuth();
          }
        }
      }
    } catch (_) {}
  });

  $effect(() => {
    // If user is already authenticated in Supabase, redirect to account or target page
    if (authStore.user && !loading) {
      clearPersistedAuth();
      const redirectUrl = $page.url.searchParams.get("redirect") || "/account";
      authLogger.info(`User authenticated, redirecting to ${redirectUrl}`);
      goto(redirectUrl);
    }
  });

  async function handleSendMagicLink() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      errorMsg = "Please enter a valid email address";
      return;
    }

    loading = true;
    errorMsg = "";
    authLogger.info("Requesting login OTP / link...", { email: cleanEmail });

    try {
      const result = await authStore.signInWithOtp(cleanEmail);
      if (result.error) {
        errorMsg = result.error;
        console.error("[Auth] signInWithOtp error:", result.error);
      } else {
        uiStore.addToast("Verification code sent to your email 📩", "success");
        authStep = "verify";
        persistAuthStep(cleanEmail, 30);
        startCooldown(30);
      }
    } catch (err) {
      errorMsg =
        err instanceof Error ? err.message : "Failed to send verification code";
      console.error("[Auth] signInWithOtp caught error:", err);
    } finally {
      loading = false;
    }
  }

  async function handleVerifyOtp() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      errorMsg = "Please enter the 6-digit verification code";
      return;
    }

    loading = true;
    errorMsg = "";
    authLogger.info("Verifying OTP code...", { email: cleanEmail });

    try {
      const result = await authStore.verifyOtp(cleanEmail, cleanOtp);
      if (result.error) {
        errorMsg = result.error;
        console.error("[Auth] verifyOtp error:", result.error);
      } else {
        clearPersistedAuth();
        uiStore.addToast("Signed in successfully!", "success");
      }
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : "Verification failed";
      console.error("[Auth] verifyOtp exception:", err);
    } finally {
      loading = false;
    }
  }

  async function handleResendMagicLink() {
    if (resendCooldown > 0) return;
    await handleSendMagicLink();
  }

  function handleGoBack() {
    clearPersistedAuth();
    authStep = "request";
    otpCode = "";
    errorMsg = "";
  }
</script>

<svelte:head>
  <title>Login / Sign In — French Toes</title>
  <meta name="description" content="Sign in securely to your French Toes account to track orders and manage wishlist." />
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4 py-12 bg-[#F9F6F2]">
  <div class="w-full max-w-md">
    <!-- Logo & Header -->
    <div class="text-center mb-8">
      <a href="/" class="inline-flex items-center gap-2 mb-4 group" aria-label="French Toes Home">
        <img src="/images/logo-bird-brand.png" alt="French Toes Logo" class="w-8 h-8 object-contain" />
        <span class="font-serif text-2xl font-normal tracking-tight text-[#1A1A1A]">
          French <span class="italic text-[#D4A5A5]">Toes</span>
        </span>
      </a>
      <h1 class="font-serif text-3xl font-normal text-[#1A1A1A] tracking-tight">
        {#if authStep === "request"}
          Sign In / Register
        {:else}
          Enter Verification Code
        {/if}
      </h1>
      <p class="mt-2 text-xs sm:text-sm text-[#6B6B6B]">
        {#if authStep === "request"}
          Enter your email to receive a secure instant login code
        {:else}
          We sent a 6-digit code to <b class="text-[#1A1A1A]">{email}</b>
        {/if}
      </p>
    </div>

    <!-- Auth Card -->
    <div class="bg-white rounded-2xl p-6 sm:p-8 border border-[#E8E4E0] shadow-xl flex flex-col">
      <!-- Error Banner -->
      {#if errorMsg}
        <div class="w-full mb-5 px-4 py-3 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-200">
          {errorMsg}
        </div>
      {/if}

      {#if authStep === "request"}
        <!-- Mode Switcher -->
        <div class="flex items-center justify-center p-1 bg-[#F5F2ED] rounded-xl mb-5">
          <button
            type="button"
            onclick={() => { authMode = "otp"; errorMsg = ""; }}
            class="flex-1 py-2 text-xs font-semibold rounded-lg transition-all {authMode === 'otp' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#7A7A7A] hover:text-[#1A1A1A]'}"
          >
            Email Code / OTP 📩
          </button>
          <button
            type="button"
            onclick={() => { authMode = "password"; errorMsg = ""; }}
            class="flex-1 py-2 text-xs font-semibold rounded-lg transition-all {authMode === 'password' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#7A7A7A] hover:text-[#1A1A1A]'}"
          >
            Password 🔑
          </button>
        </div>

        {#if authMode === "otp"}
          <!-- Step 1: Request OTP -->
          <form
            onsubmit={(e) => {
              e.preventDefault();
              handleSendMagicLink();
            }}
            class="flex flex-col gap-5"
          >
            <div class="flex flex-col gap-2">
              <label for="email-input" class="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]">
                Email Address
              </label>
              <input
                id="email-input"
                type="email"
                bind:value={email}
                disabled={loading}
                placeholder="e.g. yourname@gmail.com"
                required
                class="w-full px-4 py-3 rounded-lg border border-[#E8E4E0] text-sm text-[#1A1A1A] bg-[#FFFFFF] outline-none focus:border-[#1A1A1A] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              class="w-full py-3.5 rounded-lg text-xs font-semibold tracking-wider uppercase text-white bg-[#1A1A1A] hover:bg-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {#if loading}
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Sending Code...</span>
              {:else}
                <span>Send Verification Code &rarr;</span>
              {/if}
            </button>
          </form>
        {:else}
          <!-- Password Login Form -->
          <form
            onsubmit={(e) => {
              e.preventDefault();
              handlePasswordLogin();
            }}
            class="flex flex-col gap-4"
          >
            <div class="flex flex-col gap-2">
              <label for="pwd-email-input" class="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]">
                Email Address
              </label>
              <input
                id="pwd-email-input"
                type="email"
                bind:value={email}
                disabled={loading}
                placeholder="e.g. hello@frenchtoes.in"
                required
                class="w-full px-4 py-3 rounded-lg border border-[#E8E4E0] text-sm text-[#1A1A1A] bg-[#FFFFFF] outline-none focus:border-[#1A1A1A] transition-colors"
              />
            </div>

            <div class="flex flex-col gap-2">
              <label for="password-input" class="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]">
                Password
              </label>
              <input
                id="password-input"
                type="password"
                bind:value={password}
                disabled={loading}
                placeholder="••••••••"
                required
                class="w-full px-4 py-3 rounded-lg border border-[#E8E4E0] text-sm text-[#1A1A1A] bg-[#FFFFFF] outline-none focus:border-[#1A1A1A] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              class="w-full py-3.5 rounded-lg text-xs font-semibold tracking-wider uppercase text-white bg-[#1A1A1A] hover:bg-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
            >
              {#if loading}
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Signing In...</span>
              {:else}
                <span>Sign In with Password &rarr;</span>
              {/if}
            </button>
          </form>
        {/if}
      {:else}
        <!-- Step 2: Verify OTP (Persists across app switching & page reloads) -->
        <form
          onsubmit={(e) => {
            e.preventDefault();
            handleVerifyOtp();
          }}
          class="flex flex-col gap-5"
        >
          <div class="flex flex-col gap-2">
            <div class="flex justify-between items-center">
              <label for="otp-input" class="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]">
                6-Digit Code
              </label>
              <button
                type="button"
                onclick={handleGoBack}
                class="text-xs text-[#D4A5A5] hover:text-[#1A1A1A] font-medium transition-colors"
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
              autofocus
              class="w-full px-4 py-3 rounded-lg border border-[#E8E4E0] text-center text-xl font-mono tracking-widest text-[#1A1A1A] bg-[#FFFFFF] outline-none focus:border-[#1A1A1A] transition-colors"
            />
            <p class="text-[11px] text-center mt-2 text-[#6B6B6B] leading-relaxed">
              Check your email app for the 6-digit code or click the magic link directly.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            class="w-full py-3.5 rounded-lg text-xs font-semibold tracking-wider uppercase text-white bg-[#1A1A1A] hover:bg-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {#if loading}
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Verifying...</span>
            {:else}
              <span>Verify &amp; Sign In</span>
            {/if}
          </button>

          <!-- Resend Cooldown -->
          <div class="text-center mt-1">
            {#if resendCooldown > 0}
              <p class="text-xs text-[#9A9A9A]">
                Resend code in <span class="font-semibold text-[#1A1A1A]">{resendCooldown}s</span>
              </p>
            {:else}
              <button
                type="button"
                onclick={handleResendMagicLink}
                class="text-xs font-semibold text-[#1A1A1A] hover:underline"
              >
                Didn't get the code? Resend Code 📩
              </button>
            {/if}
          </div>
        </form>
      {/if}

      <p class="text-[11px] text-center mt-6 text-[#9A9A9A]">
        By signing in you agree to our
        <a href="/terms" class="underline text-[#1A1A1A]">Terms</a> &amp;
        <a href="/privacy" class="underline text-[#1A1A1A]">Privacy Policy</a>.
      </p>
    </div>

    <!-- Back to shop -->
    <p class="text-center mt-6 text-xs text-[#6B6B6B]">
      <a href="/shop" class="hover:text-[#1A1A1A] transition-colors">
        &larr; Continue shopping
      </a>
    </p>
  </div>
</div>
