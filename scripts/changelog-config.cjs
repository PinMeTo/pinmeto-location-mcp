/**
 * Custom changelog generator for Changesets
 *
 * Produces clean Keep-a-Changelog style output:
 * - No "Thanks @author!" messages
 * - Concise bullet points with PR links
 * - Date headers added by release:version script
 *
 * @see https://github.com/changesets/changesets/blob/main/docs/modifying-changelog-format.md
 */

const getReleaseLine = async (changeset, type, options) => {
  // Extract first line only (summary), ignore verbose details
  const firstLine = changeset.summary.split('\n')[0].trim();

  // Get PR number from commit if available (set by @changesets/changelog-github data)
  // But we format it ourselves without the "Thanks" message
  let prLink = '';
  if (changeset.commit) {
    // If there's associated PR data, we could fetch it, but for simplicity
    // we'll just include the commit hash for traceability
    const shortCommit = changeset.commit.slice(0, 7);
    prLink = ` (\`${shortCommit}\`)`;
  }

  return `- ${firstLine}${prLink}`;
};

const getDependencyReleaseLine = async () => {
  // Skip dependency updates in changelog - they're noise
  return '';
};

module.exports = {
  getReleaseLine,
  getDependencyReleaseLine,
};
