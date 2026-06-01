const AccountSuspended = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="max-w-2xl rounded-3xl border border-border bg-surface p-10 shadow-xl">
        <div className="space-y-6 text-center">
          <img src="/logo.png" alt="GWA Logo" className="w-16 h-16 mx-auto rounded-lg shadow-md" />
          <div className="inline-flex items-center justify-center rounded-full bg-warning/10 p-4 text-warning">
            <span className="text-4xl font-bold">!</span>
          </div>
          <div>
            <h1 className="text-4xl font-semibold">Account Suspended</h1>
            <p className="mt-3 text-base text-muted-foreground">
              Your account has been temporarily suspended. For security reasons, access is restricted until the suspension is reviewed.
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-6 text-left">
            <p className="text-sm text-muted-foreground">If you believe this suspension is in error, contact support for appeals:</p>
            <p className="mt-3 break-all text-lg font-medium text-foreground">support@goldenwealthachivers.com</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              You can still sign out from the top navigation and then sign in again after your account is restored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSuspended;
