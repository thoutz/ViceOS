# Create a new GitHub repository and push this project

Cursor does not connect to GitHub on your behalf from the editor alone—you link accounts in **Cursor Settings → Account** (or Git) and use normal Git + GitHub.

## 1. Create the repository on GitHub

1. Open [github.com/new](https://github.com/new).
2. Choose an owner, **Repository name**, **Private** or **Public**, and **do not** add a README, `.gitignore`, or license if you already have a local project (avoids merge conflicts).
3. Create the repository.

## 2. Add GitHub as `origin` (or rename existing remote)

This workspace already has a remote named `gitsafe-backup`. To **also** push to GitHub:

```bash
cd /path/to/workspace
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
```

If `origin` already exists, either remove it first (`git remote remove origin`) or use another name, e.g.:

```bash
git remote add github https://github.com/YOUR_USER/YOUR_REPO.git
```

## 3. Commit your work and push

```bash
git status
git add -A
git commit -m "Describe your current feature set in a clear sentence."
git branch -M main   # optional: if you prefer main over master
git push -u origin main
```

Use `master` instead of `main` if that is your default branch name.

## 4. SSH instead of HTTPS (optional)

```bash
git remote add origin git@github.com:YOUR_USER/YOUR_REPO.git
```

Requires [SSH keys added to GitHub](https://docs.github.com/en/authentication/connecting-to-github-with-ssh).

## 5. Cursor ↔ GitHub

- Install the **GitHub** integration in Cursor if you want PRs/issues in the IDE.
- **GitHub CLI** (`gh auth login`) is optional; this environment may not have it installed.

After the first successful `git push`, future iterations are: `git add`, `git commit`, `git push`.
