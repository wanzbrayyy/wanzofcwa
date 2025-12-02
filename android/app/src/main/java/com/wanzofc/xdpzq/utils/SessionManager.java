package com.wanzofc.xdpzq.utils;

import android.content.Context;
import android.content.SharedPreferences;

public class SessionManager {
    private SharedPreferences pref;
    private SharedPreferences.Editor editor;
    private static final String PREF_NAME = "WanzofcSession";

    public SessionManager(Context context) {
        pref = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        editor = pref.edit();
    }

    public void createSession(String id, String username, String email) {
        editor.putBoolean("IS_LOGIN", true);
        editor.putString("ID", id);
        editor.putString("USERNAME", username);
        editor.putString("EMAIL", email);
        editor.apply();
    }

    public boolean isLogin() { return pref.getBoolean("IS_LOGIN", false); }
    public String getUserId() { return pref.getString("ID", null); }
    public String getUsername() { return pref.getString("USERNAME", "User"); }
    public void logout() { editor.clear(); editor.commit(); }
}