// File: src/main/java/com/example/speakeasy/SpeakeasyApplication.java

package com.example.speakeasy; // This MUST match your folder path: com/example/speakeasy

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

// The name of this public class MUST EXACTLY match the filename: SpeakeasyApplication.java
@SpringBootApplication
public class SpeakeasyApplication {

    public static void main(String[] args) {
        SpringApplication.run(SpeakeasyApplication.class, args);
    }

    @Controller
    public static class FrontendController {

        @GetMapping("/")
        public String serveFrontend() {
            // THIS LINE IS CRITICAL: It tells Spring Boot to serve the static index.html
            System.out.println("Serving static index.html to the browser.");
            return "forward:/index.html";
        }
    }
}
