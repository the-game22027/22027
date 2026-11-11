# Git worktrees
> One repository, several folders, each with its own branch checked out at the same time.

**Problem:** one folder can have only one branch checked out. Two Claude sessions (backend + mobile) in the same folder would switch branches under each other and mix their changes.

**How:**
- `git worktree add ../the-game-mobile -b feat/m0-mobile-foundation origin/main` creates a second folder on a new branch.
- Both folders share the same `.git` history and remote: commits made in one are visible to the other (`git log <branch>`).
- Each folder needs its own untracked files: `node_modules`, `.env`, build output. Git does not copy them.
- `git worktree list` shows every folder; `git worktree remove ../the-game-mobile` deletes the folder (the branch stays).

**In our code:** the ownership rules for the two sessions are in `CLAUDE.md` §7.1.

**Watch out:**
- The same branch cannot be checked out in two worktrees at once.
- Shared files (`CLAUDE.md`, `ROADMAP.md`) edited in both branches can conflict at merge time: keep edits small and in separate lines.

**Check yourself:** you delete the `the-game-mobile` folder with `rm -rf` instead of `git worktree remove`. What is left behind?
<details><summary>Answer</summary>A stale worktree entry in `.git/worktrees`, which keeps the branch "checked out" so no other worktree can use it. `git worktree prune` cleans it up. The commits are safe, because they live in the shared history.</details>
