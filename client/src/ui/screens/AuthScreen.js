/**
 * AuthScreen — login / register / forgot password.
 */
import { api } from '../../net/ApiClient.js';
import { html, screens } from '../ScreenManager.js';

export class AuthScreen {
  constructor() {
    this.mode = 'login';
    this.el = html`
      <div id="auth-screen" class="backdrop">
        <div class="glass panel" style="width:min(440px,92vw)">
          <div class="tabs">
            <button class="tab active" data-mode="login">Sign In</button>
            <button class="tab" data-mode="register">Register</button>
            <button class="tab" data-mode="forgot">Recover</button>
          </div>
          <form novalidate>
            <div class="field" data-field="username" style="margin-bottom:16px">
              <label class="label" for="auth-username">Username</label>
              <input id="auth-username" autocomplete="username" maxlength="32" />
            </div>
            <div class="field" data-field="email" style="margin-bottom:16px;display:none">
              <label class="label" for="auth-email">Email</label>
              <input id="auth-email" type="email" autocomplete="email" />
            </div>
            <div class="field" data-field="password" style="margin-bottom:16px">
              <label class="label" for="auth-password">Password</label>
              <input id="auth-password" type="password" autocomplete="current-password" />
            </div>
            <p class="field-error"></p>
            <button type="submit" class="btn btn-primary" style="width:100%">Sign In</button>
          </form>
          <button class="btn" data-action="back" style="width:100%">Back</button>
        </div>
      </div>`;

    this.form = this.el.querySelector('form');
    this.error = this.el.querySelector('.field-error');
    this.submitBtn = this.form.querySelector('[type="submit"]');

    this.el.querySelectorAll('.tab').forEach((tab) =>
      tab.addEventListener('click', () => this.setMode(tab.dataset.mode)));
    this.el.querySelector('[data-action="back"]')
      .addEventListener('click', () => screens.show('main-menu'));
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.submit(); });

    screens.register('auth', this.el);
  }

  setMode(mode) {
    this.mode = mode;
    this.error.textContent = '';
    this.el.querySelectorAll('.tab').forEach((t) =>
      t.classList.toggle('active', t.dataset.mode === mode));
    const show = (name, visible) => {
      this.el.querySelector(`[data-field="${name}"]`).style.display = visible ? '' : 'none';
    };
    show('username', mode !== 'forgot');
    show('email', mode !== 'login');
    show('password', mode !== 'forgot');
    this.submitBtn.textContent =
      mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link';
  }

  async submit() {
    const username = this.el.querySelector('#auth-username').value.trim();
    const email = this.el.querySelector('#auth-email').value.trim();
    const password = this.el.querySelector('#auth-password').value;
    this.error.textContent = '';
    this.submitBtn.disabled = true;
    try {
      let res;
      if (this.mode === 'login') res = await api.login(username, password);
      else if (this.mode === 'register') res = await api.register(username, email, password);
      else res = await api.forgotPassword(email);

      if (!res.ok) {
        this.error.textContent = res.error === 'offline'
          ? 'Server unreachable — you can still play offline.'
          : res.error;
        return;
      }
      if (this.mode === 'forgot') {
        this.error.textContent = 'If that email exists, a reset link was sent.';
        return;
      }
      screens.show('main-menu');
    } finally {
      this.submitBtn.disabled = false;
    }
  }
}
