package com.dvicmirror.magicmirrornfc;

/* Google Calendar NFC
 * By 0xUKN
 * Based on https://github.com/justinribeiro/android-hostcardemulation-sample/
 */

// IMPORTS
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.nfc.cardemulation.HostApduService;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.widget.Toast;
import java.lang.Math;
import java.nio.charset.Charset;

// Service class which extends HostApduService for Host-based Card Emulation on Android (NFC)
public class googleCalendarTokenNFCService extends HostApduService {

    private static final String TAG = googleCalendarTokenNFCService.class.getSimpleName();

    // Max length for a data fragment (little data fragments are more reliable after some tests)
    private static final byte MAX_LENGTH = 20;

    // We use the default AID from the HCE Android documentation
    // https://developer.android.com/guide/topics/connectivity/nfc/hce.html
    //
    // <aid-filter android:name="F0394148148100" />
    // To use other accounts, copy service and modify AID...
    private static final byte[] APDU_SELECT_AID = {
            (byte) 0x00,
            (byte) 0xA4,
            (byte) 0x04,
            (byte) 0x00,
            (byte) 0x07,
            (byte) 0xF0, (byte) 0x39, (byte) 0x41, (byte) 0x48, (byte) 0x14, (byte) 0x81, (byte) 0x00, // AID
            (byte) 0x00
    };

    // Sent at the end of a successful transaction
    private static final byte[] A_OKAY = {
            (byte) 0x90,
            (byte) 0x00
    };

    // Sent at the end of a failed transaction
    private static final byte[] A_NOT_OKAY = {
            (byte) 0x90,  // SW1	Status byte 1 - Command processing status
            (byte) 0x01   // SW2	Status byte 2 - Command processing qualifier
    };

    // Sent at the end of a incomplete/not finished transaction (some data are still waiting to be sent)
    private static final byte[] A_REMAINING = {
            (byte) 0x90,  // SW1	Status byte 1 - Command processing status
            (byte) 0x02   // SW2	Status byte 2 - Command processing qualifier
    };

    // Google Calendar token for Google API
    private byte[] TOKEN_DATA = null;

    // Called when the service starts
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {

        Log.d(TAG, "Starting ...");

        if (intent.hasExtra("tokenMessage")) {
            TOKEN_DATA = intent.getStringExtra("tokenMessage").getBytes(Charset.forName("UTF-8"));
            Context context = getApplicationContext();
            CharSequence text = "Google Calendar is now available !";
            int duration = Toast.LENGTH_SHORT;
            Toast toast = Toast.makeText(context, text, duration);
            toast.setGravity(Gravity.CENTER, 0, 0);
            toast.show();
        } else {
            Context context = getApplicationContext();
            CharSequence text = "No account specified !";
            int duration = Toast.LENGTH_SHORT;
            Toast toast = Toast.makeText(context, text, duration);
            toast.setGravity(Gravity.CENTER, 0, 0);
            toast.show();
        }

        Log.i(TAG, "onStartCommand() executed | Token : " + new String(TOKEN_DATA));
        return Service.START_NOT_STICKY;
    }

    // Called when an NFC reader send data to our service
    @Override
    public byte[] processCommandApdu(byte[] commandApdu, Bundle extras) {
        Log.i(TAG, "processCommandApdu() called | incoming APDU command : " + utils.bytesToHex(commandApdu));

        // The last byte sent corresponds to the offset of the currently transmitted data
        int offset = Math.abs(commandApdu[commandApdu.length - 1] & 0xff); // 0 complement for negative values
        byte[] realCommandApdu = new byte[commandApdu.length - 1];
        System.arraycopy(commandApdu, 0, realCommandApdu, 0, commandApdu.length - 1);

        // APDU Select
        // Always sent at the beginning of the transaction
        // to indicate to Android to which service we want to access
        if (utils.isEqual(APDU_SELECT_AID, realCommandApdu) && TOKEN_DATA != null && offset < TOKEN_DATA.length) {
            Log.i(TAG, "processCommandApdu() | APDU_SELECT_AID triggered");

            byte[] response = null;
            // Let's build our response
            response = new byte[MAX_LENGTH];
            System.arraycopy(TOKEN_DATA, offset, response, 0, Math.min(MAX_LENGTH - 2, TOKEN_DATA.length - offset));

            // This is the last fragment of data
            if (offset + MAX_LENGTH - 2 >= TOKEN_DATA.length) {
                System.arraycopy(A_OKAY, 0, response, MAX_LENGTH - 2, A_OKAY.length);
                Log.i(TAG, "Response (finished) : " + utils.bytesToHex(response));
                Context context = getApplicationContext();
                CharSequence text = "Google Calendar token has been sent to the reader!";
                int duration = Toast.LENGTH_SHORT;
                Toast toast = Toast.makeText(context, text, duration);
                toast.setGravity(Gravity.CENTER, 0, 0);
                toast.show();
            } else { // There are remaining data waiting to be sent
                System.arraycopy(A_REMAINING, 0, response, MAX_LENGTH - 2, A_REMAINING.length);
                Log.i(TAG, "Response (remaining) : " + utils.bytesToHex(response));
            }
            return response;
        }

        // We're doing something outside our scope
        Log.wtf(TAG, "processCommandApdu() | Invalid command !");
        return A_NOT_OKAY;
    }

    // Called at the end of a complete transaction
    @Override
    public void onDeactivated(int reason) {
        Log.i(TAG, "onDeactivated() called Reason: " + reason);
    }

    // Called when the service is destroyed (= at exit)
    @Override
    public void onDestroy() {
        super.onDestroy();
    }

}