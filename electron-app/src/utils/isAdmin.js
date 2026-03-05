export const isAdminAccount = (account) => {
  const email =
    account?.username?.toLowerCase() ||
    account?.idTokenClaims?.preferred_username?.toLowerCase() ||
    account?.idTokenClaims?.upn?.toLowerCase() ||
    "";
  return email === "secretariat@ecnp.eu";
};
