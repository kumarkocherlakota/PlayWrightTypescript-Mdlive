// Synthetic patient portal: shared API access and formatting for the portal pages.

/** Calls a reference-app API with the session cookie; sends the browser to sign in on 401. */
export async function callApi(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { Accept: 'application/json', ...(options.headers ?? {}) },
  });
  if (response.status === 401) {
    window.location.assign('/portal/sign-in');
    return { status: 401, body: {} };
  }
  const body = response.status === 204 ? {} : await response.json();
  return { status: response.status, body };
}

/** Builds a <time> element: machine-readable ISO value, text in the viewer's time zone. */
export function timeElement(iso) {
  const time = document.createElement('time');
  time.dateTime = iso;
  time.textContent = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
  return time;
}

export function cell(content) {
  const td = document.createElement('td');
  if (content instanceof Node) {
    td.append(content);
  } else {
    td.textContent = content;
  }
  return td;
}
