package com.wanzofc.xdpzq.models;
public class StatsResponse {
    public boolean success;
    public Data data;
    public static class Data { 
        public String username; 
        public int totalBot, activeBot, limitBot; 
        public boolean isPremium; 
    }
}