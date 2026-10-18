# Vendored libraries

`supabase-js-2.117.2.js` is `dist/umd/supabase.js` from the npm package
`@supabase/supabase-js@2.117.2` (MIT licence, see `supabase-js-LICENSE.txt`).

It is kept in the repo so the site loads nothing from a CDN at runtime.

- npm tarball integrity (checked when downloaded):
  `sha512-eSG2VKnHR+Clp1PmidZ1/weJ8PJwoybjva3L2GgKqFG4YDS1Iqmc61psKGZP5xw6OMT2O7ZorPR42PY6q1BOXg==`
- file hash used in `index.html` (`integrity=`):
  `sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok`

The browser refuses to run the file if it doesn't match that hash.

## Updating

1. Download `https://registry.npmjs.org/@supabase/supabase-js/-/supabase-js-<version>.tgz`.
2. Check its sha512 against `dist.integrity` at
   `https://registry.npmjs.org/@supabase/supabase-js/<version>`.
3. Extract `package/dist/umd/supabase.js`, save it here as `supabase-js-<version>.js`, delete the old file.
4. Compute the new sha384 (PowerShell:
   `[Convert]::ToBase64String([Security.Cryptography.SHA384]::Create().ComputeHash([IO.File]::ReadAllBytes("vendor\supabase-js-<version>.js")))`)
   and update the `<script>` tag in `index.html`.
