package com.dvicmirror.magicmirrornfc;

/* Google Calendar NFC
 * By 0xUKN
 */

// IMPORTS
import android.content.Context;
import android.os.Bundle;
import android.util.Log;
import java.util.ArrayList;
import java.util.List;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.app.ActionBar;
import android.content.Intent;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.Toast;

// Main activity class
public class MainActivity extends AppCompatActivity {

    private static final String TAG = MainActivity.class.getSimpleName();

    // Auth code for Google Calendar
    static final int AUTH_CODE_GOOGLE_CALENDAR = 0;

    // Track all running services
    private List<Intent> runningServices = new ArrayList<Intent>();
    private Button googleCalendarButton;

    // Called at creation (main)
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        ActionBar toolbar = getSupportActionBar();
        toolbar.setTitle(R.string.app_name);

        googleCalendarButton = findViewById(R.id.google_calendar_button);

        //Init Google Calendar connect button
        googleCalendarButton.setText(R.string.google_calendar_button_connect);
        googleCalendarButton.setOnClickListener(new View.OnClickListener() {
                                       @Override
                                       public void onClick(View view) {
                                           // On click, call the Google Account manager activity
                                           Intent intent = new Intent(view.getContext(), googleCalendarAuthManagerActivity.class);
                                           startActivityForResult(intent, AUTH_CODE_GOOGLE_CALENDAR);
                                       }
                                   }
        );

    }

    // Called when an activity exit (Google account manager activity)
   @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

       switch (requestCode) {
           // If the result comes from the Google account manager activity
           case AUTH_CODE_GOOGLE_CALENDAR:
                if (resultCode == RESULT_OK) {
                    String returnedResult = data.getData().toString();
                    Log.i(TAG, "Google Calendar token : " + returnedResult);

                    final Intent intent = new Intent(getApplicationContext(), googleCalendarTokenNFCService.class);
                    intent.putExtra("tokenMessage", returnedResult);

                    // Run Google Calendar NFC service
                    runningServices.add(intent);
                    startService(intent);

                    // Init Google Calendar disconnect button
                    googleCalendarButton.setText(R.string.google_calendar_button_disconnect);
                    googleCalendarButton.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View view) {

                            // Stop running Google Calendar NFC service
                            stopService(intent);
                            Context context = getApplicationContext();
                            CharSequence text = "Disconnected Google Calendar account !";
                            int duration = Toast.LENGTH_SHORT;
                            Toast toast = Toast.makeText(context, text, duration);
                            toast.setGravity(Gravity.CENTER, 0, 0);
                            toast.show();

                            Log.i(TAG, "Exiting service ...");
                            // Reset Google Calendar connect button
                            googleCalendarButton.setText(R.string.google_calendar_button_connect);
                            googleCalendarButton.setOnClickListener(new View.OnClickListener() {
                                @Override
                                public void onClick(View view) {
                                    Intent intent = new Intent(view.getContext(), googleCalendarAuthManagerActivity.class);
                                    startActivityForResult(intent, AUTH_CODE_GOOGLE_CALENDAR);
                                }
                            });
                        }
                    });
                }
        }
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
    public void onStop() {
        super.onStop();
    }

    @Override
    public void onDestroy() {
        // Kill all running services on exit
        for(Intent service : runningServices)
        {
            stopService(service);
        }
        super.onDestroy();
    }

}