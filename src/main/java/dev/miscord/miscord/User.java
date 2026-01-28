package dev.miscord.miscord;

public class User {
    private String id;      // WebSocket session id
    private String username;
    private String status; // online, speaking, muted
    private long lastActivity;

    public User(String id, String username) {
        this.id = id;
        this.username = username;
        this.status = "online";
        this.lastActivity = System.currentTimeMillis();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getStatus() { return status; }
    public void setStatus(String status) {
        this.status = status;
        this.lastActivity = System.currentTimeMillis();
    }

    public long getLastActivity() { return lastActivity; }
    public void setLastActivity(long lastActivity) { this.lastActivity = lastActivity; }
}