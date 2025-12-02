package com.wanzofc.xdpzq.models;
public class RegisterRequest {
    private String username, email, password, fullname, whatsappNumber;
    public RegisterRequest(String u, String e, String p, String f, String w) {
        this.username=u; this.email=e; this.password=p; this.fullname=f; this.whatsappNumber=w;
    }
}