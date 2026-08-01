/* Inquiry forms — submit without leaving the page.
   The destination address lives with the relay, never here. Falls back to a normal
   form POST if JS is off, which still works. */

document.querySelectorAll('form.inquiry').forEach(form => {
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    status.removeAttribute('data-state');
    status.textContent = 'Sending…';
    button.disabled = true;

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });

      if (!response.ok) throw new Error(String(response.status));

      form.reset();
      status.textContent = 'Sent. You’ll get a reply directly.';
    } catch {
      status.setAttribute('data-state', 'error');
      status.textContent = 'That didn’t send. Please try again in a moment.';
    } finally {
      button.disabled = false;
    }
  });
});
