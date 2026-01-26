package dev.miscord.miscord;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ChatController {

    @GetMapping("/")
    public String home() {
        return "main";
    }
    
    @GetMapping("/chat")
    public String chat() {
        return "main";
    }
}