// Synthetic patient portal: shows a generic error after a failed sign-in. The message never says
// whether the e-mail exists (no account enumeration).
const error = new URLSearchParams(window.location.search).get('error');
if (error !== null) {
  const alert = document.getElementById('sign-in-error');
  alert.textContent = 'The email or password is incorrect.';
  alert.hidden = false;
}
