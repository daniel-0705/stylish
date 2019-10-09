Web-Backend-2019-Summer 

# Week 1 Part 1
Daniel

# Week 1 Part 2

##Build Node.js Project for Web Server

http://3.130.119.187/

## Run Web Server in the Background

You should keep web server alive even if you close connection from your instance or do other tasks at the same time.  
Find a way to run web server in the background and **write down your solution in README.md file.**

1. Install pm2 by running the following command
npm install -g pm2
2. Set up pm2 to start the server automatically on server restart.
pm2 start app.js
pm2 save
pm2 startup
3. Note that after running the pm2 startup command we get a command starting with ¡§sudo¡¨.
4. Copy that command from sudo till the end of the next line and paste it in the terminal and press enter.
5. Now your node server is running and is set to start automatically whenever you restart the EC2 instance.

reference:https://hackernoon.com/deploying-a-node-app-on-amazon-ec2-d2fb9a6757eb


# Week 1 Part 3

##Build Product Management Page

http://3.130.119.187/admin/product.html

# Week 1 Part 4

##Product List API

http://3.13.81.63/api/v1/products/all  
http://3.13.81.63/api/v1/products/women  
http://3.13.81.63/api/v1/products/men  
http://3.13.81.63/api/v1/products/accessories

# Week 1 Part 5

##Product Search API

http://3.130.119.187/api/v1/products/search


##Product Details API

http://33.130.119.187/api/v1/products/details

# Week 2 Part 1

##Build Marketing Campaigns Management Page

http://3.130.119.187/admin/campaign.html  
http://3.130.119.187/api/v1/marketing/campaigns


# Week 2 Part 2 and Week 2 Part 3


##Build User Sign Up APIs

http://3.130.119.1873/admin/sign_up.html

##Build User Sign In APIs

http://3.130.119.187/admin/sign_in.html

##Build User Profile APIs

http://3.130.119.187/user/profile

# Week 2 Part 4 and Week 2 Part 5

http://3.130.119.187/admin/checkout.html    
http://3.130.119.187/order/checkout

# Week 3 Part 1

http://3.130.119.187

# Week 3 Part 2

http://3.130.119.187 (Dynamic Product Page)

# Week 3 Part 3

http://3.130.119.187 (Check Out Procedure Profile Page)

# Week 3 Part 4

http://3.130.119.187 (Build Cache Mechanism)