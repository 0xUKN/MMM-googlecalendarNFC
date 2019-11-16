package com.dvicmirror.magicmirrornfc;

/* Google Calendar NFC
 * By 0xUKN
 * Based on Google official documentation
 */

// IMPORTS
import android.os.Bundle;
import android.util.Log;
import android.accounts.Account;
import android.accounts.AccountManagerFuture;
import android.accounts.AccountManager;
import android.accounts.AccountManagerCallback;
import android.accounts.OperationCanceledException;
import android.app.Dialog;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.net.Uri;
import android.content.Intent;
import androidx.appcompat.app.ActionBar;
import androidx.appcompat.app.AppCompatActivity;

// Activity class which implements Google OAuth authentication for Google Calendar
public class googleCalendarAuthManagerActivity extends AppCompatActivity {

    private static final String TAG = googleCalendarAuthManagerActivity.class.getSimpleName();

    private static final int DIALOG_ACCOUNTS = 0;
    private static String SCOPE_TYPE = "oauth2:https://www.googleapis.com/auth/calendar.readonly";
    private AccountManager accountManager = null;

    // Called at class creation
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ActionBar toolbar = getSupportActionBar();
        toolbar.setTitle("Google Calendar - " + getResources().getString(R.string.app_name));

        // Create our future account manager
        accountManager = AccountManager.get(googleCalendarAuthManagerActivity.this);
        // Show dialog box to pick a Google Account
        showDialog(DIALOG_ACCOUNTS);

    }

    // Called when the dialog box pops
    @Override
    protected Dialog onCreateDialog(int id) {
        switch (id) {
            case DIALOG_ACCOUNTS:
                AlertDialog.Builder builder = new AlertDialog.Builder(this);
                builder.setTitle("Select a Google account");
                final Account[] accounts = accountManager.getAccountsByType("com.google");
                final int size = accounts.length;
                String[] names = new String[size];
                for (int i = 0; i < size; i++) {
                    names[i] = accounts[i].name;
                }
                builder.setItems(names, new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int which) {
                        // Authenticate with the chosen Google Account
                        Authenticate(accounts[which]);
                    }
                });
                builder.setOnCancelListener(new DialogInterface.OnCancelListener() {
                    @Override
                    public void onCancel(DialogInterface dialog) {
                        Log.i(TAG, "Google Calendar Dialog canceled !");
                        setResult(RESULT_CANCELED);
                        finish();
                    }

                });
                return builder.create();
        }
        return null;
    }

    // Authentication function
    public void Authenticate(Account account)
    {
        Log.d(TAG, "Authentication with " + account.name);
        accountManager.getAuthToken(account, SCOPE_TYPE, null, googleCalendarAuthManagerActivity.this, new AccountManagerCallback<Bundle>() {
            public void run(AccountManagerFuture<Bundle> future) {
                try {
                    // If the user has authorized your application to use the tasks API
                    // a token is available.
                    String token = future.getResult().getString(AccountManager.KEY_AUTHTOKEN);
                    // Return this token
                    Intent data = new Intent();
                    data.setData(Uri.parse(token));
                    setResult(RESULT_OK, data);
                } catch (OperationCanceledException e) {
                    Log.i(TAG, Log.i(TAG, "Google Calendar Dialog canceled :") + e.toString());
                    setResult(RESULT_CANCELED);
                } catch (Exception e) {
                    Log.i(TAG, Log.i(TAG, "Google Calendar Dialog canceled :") + e.toString());
                    setResult(RESULT_CANCELED);
                }
                finally {
                    Log.i(TAG, "Google Calendar Dialog validated !");
                    finish();
                }
            }
        }, null);

    }

    @Override
    public void onResume() {
        super.onResume();
    }

    @Override
    public void onPause() {
        super.onPause();
    }

    @Override
    public void onStop() { super.onStop(); }

    @Override
    public void onDestroy() {
        super.onDestroy();
    }

}
