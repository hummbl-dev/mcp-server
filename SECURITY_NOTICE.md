# Security Notice - API Key Exposure (January 30, 2026)

## Summary

During a comprehensive security audit on January 30, 2026, we discovered that 6 API key files were inadvertently committed to the repository and existed in the git history.

## Impact

**Severity**: Critical  
**Affected**: API keys from test/development environment  
**Status**: RESOLVED

## Timeline

- **January 30, 2026 14:54 UTC**: Discovery during comprehensive audit
- **January 30, 2026 15:00 UTC**: API keys removed from repository
- **January 30, 2026 15:00 UTC**: .gitignore updated to prevent future exposure

## Affected API Keys (Now Invalid)

The following API key IDs were exposed and have been invalidated:
- `b623a123-7be3-4f97-ac53-4d0d5688439e` (Free tier - test key)
- `b80fc051-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (Free tier - test key)
- `ce91ecf1-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (Free tier - test key)
- `de43ad27-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (Free tier - test key)
- `13276ea2-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (Pro tier - test key)
- `a5e31daf-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (Enterprise tier - test key)

## Actions Taken

1. ✅ All exposed API keys have been **revoked and invalidated**
2. ✅ Files removed from git tracking
3. ✅ `.gitignore` updated with comprehensive patterns:
   - `api-key*.json`
   - `*.key`
   - `*.pem`
   - `*.bak`, `*.old`, `*.new`, `*.tmp`
4. ✅ Comprehensive audit report created
5. ⏳ Git history cleanup (in progress)

## Required Actions for Users

### If you cloned this repository:
1. **Pull the latest changes** to get the updated `.gitignore`
2. **Do NOT use any API keys** from previously cloned versions
3. **Request new API keys** if you need them for development

### If you are using the production API:
- No action required - production keys were never exposed
- This incident only affected test/development keys

## Prevention Measures

Going forward, we have implemented:

1. **Enhanced .gitignore**: Prevents committing secrets
2. **Audit process**: Regular security audits
3. **Documentation**: Updated security guidelines in CONTRIBUTING.md
4. **Secrets management**: Moving to environment variables and Cloudflare Secrets

## Recommendations for Contributors

To prevent similar issues:

1. **Never commit secrets**: Use environment variables or secrets managers
2. **Use .env.example**: Create template files with placeholders
3. **Review before commit**: Check `git status` and `git diff` before committing
4. **Enable pre-commit hooks**: Use tools like `husky` and `git-secrets`
5. **Scan for secrets**: Use tools like `gitleaks` or `trufflehog`

## Git History Cleanup

**IMPORTANT**: Due to the exposure in git history, we recommend:

For maintainers:
```bash
# Option 1: Using BFG Repo-Cleaner (recommended)
bfg --delete-files 'api-key*.json' --no-blob-protection
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Option 2: Using git-filter-repo
git filter-repo --path api-key-enterprise-a5e31daf.json --invert-paths
# Repeat for each file
```

For users:
```bash
# After history is cleaned, re-clone the repository
git clone https://github.com/hummbl-dev/mcp-server.git
```

## References

- [GitHub: Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [OWASP: Secrets Management Cheat Sheet](https://cheatsheetsheep.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

## Contact

For questions or concerns about this security notice:
- **Security issues**: security@hummbl.io
- **General questions**: reuben@hummbl.io

## Disclosure

This security notice is being made publicly as part of our commitment to transparency and responsible disclosure. No actual user data or production systems were compromised.

---

**Last Updated**: January 30, 2026  
**Status**: Resolved - Monitoring
