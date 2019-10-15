var express=require("express");                     //express 模組
var app=express();                                  //express 模組
var bodyParser = require('body-parser');            //body-parser 模組
var path = require('path');                          //path 模組
var multer  = require('multer');                  //multer 模組
var admin = multer({ dest: './public' });        //multer 模組
var request = require('request');             //request 模組
var async = require('async');                 //async模組
const crypto = require('crypto');              //crypto 模組
const https = require('https')                 //https模組
const NodeCache = require( "node-cache" );    //node-cache模組
const myCache = new NodeCache({stdTTL: 60, checkperiod: 0});                //node-cache模組
var aws = require('aws-sdk')                     //Multer S3模組
var multerS3 = require('multer-s3')              //Multer S3模組


//configuring the AWS environment
aws.config.update({
    accessKeyId: "",
    secretAccessKey: "",
    region:""
});

var s3 = new aws.S3()        //Multer S3模組 接在configuring the AWS environment後面

//multer S3 模組
var admin= multer({
    storage: multerS3({
        s3: s3,
        bucket: 'daniel0705',
        metadata: function (req, file, cb) {
            cb(null, {fieldName: file.fieldname});
        },
        key: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now()+".jpg")
        }
    }) 
});


//靜態檔案 模組
app.use('/',express.static('public'));
//為了可以讀取header裡面的內容
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// DataBase connect
var mysql = require("mysql");


// 建立pool 所以 connection 就不用，因為個別會建立自己的連線
var pool = mysql.createPool({
    connectionLimit:10,
    host: "",
    user: "",
    password: "",
    database: "",
    multipleStatements: true
});



//user input the product data from product.html and send here
app.post("/admin/product", admin.fields([{name:'main_image',maxCount:1},{name:'images',maxCount:2}]),function(req,res){

    let mySQL_insert = function (table_name,obj){
        pool.query(`insert into ${table_name} set ?`,obj,function (err,rs) {
            if (err) {
                console.log(`insert ${table_name} table fail`);
            }else{
                console.log(`insert ${table_name} table ok`);
            }
        });
    };

    
    //input insert to database test table products 
    var product_object={
        id:parseInt(req.body.id),
        title:req.body.title,
        description:req.body.description,
        price:req.body.price,
        texture:req.body.texture,
        wash:req.body.wash,
        place:req.body.place,
        note:req.body.note,
        story:req.body.story,
        main_image:req.files['main_image'][0].location,
        attribute:req.body.attribute
    };
    mySQL_insert("products",product_object);

    //input insert to database test table color 
    if (typeof req.body.color_code == "string"){
        var colors_object={
            id:parseInt(req.body.id),
            code : req.body.color_code,
            name : req.body.color_name
        };
        mySQL_insert("color",colors_object);

    }else{
        for (var i = 0 ;i <req.body.color_code.length ;i++){ 
            var colors_object={
                id:parseInt(req.body.id),
                code : req.body.color_code[i],
                name : req.body.color_name[i]
            };
            mySQL_insert("color",colors_object);
        } 
    }

    //input insert to database test table variant 
    if (typeof req.body.color_code == "string"){
        var variant_object={
            id:parseInt(req.body.id),
            color_code : req.body.color_code,
            size : req.body.size,
            stock:parseInt(req.body.stock)
        };
        mySQL_insert("variant",variant_object);
    }else{
        for (var i = 0 ;i <req.body.color_code.length ;i++){ 
            var variant_object={
                id:parseInt(req.body.id),
                color_code : req.body.color_code[i],
                size : req.body.size[i],
                stock:parseInt(req.body.stock[i])
            };
            mySQL_insert("variant",variant_object);
        };    
    };
    // input insert to database test table sizes 
    req.body.size =[...new Set(req.body.size)];
    for (var i = 0 ;i <req.body.size.length ;i++){
        var size_object={
            id:parseInt(req.body.id),
            size : req.body.size[i]
        };
        mySQL_insert("sizes",size_object);
    }

    // input insert to database test table images 
    for (var i = 0 ;i <req.files.images.length ;i++){
        var images_object={
            id:parseInt(req.body.id),
            images : req.files.images[i].location
        };
        mySQL_insert("images",images_object);
    }

    res.redirect('/');
});
 
//output all the products data
app.get("/api/v1/products/all",function(req,res){

    //先把全部產品id抓出來
    let limit_number = 6;
    let paging;
    if (isNaN(req.query.paging)){
        paging = 0;
    }else{
        paging = parseInt(req.query.paging);
    }
    let offset_number = 6 * paging;

    //優化寫法 改用一次 query 比較看看
    pool.query(`SELECT COUNT(id) from products` ,function (err,result) {
        
        if (err || result.length === 0) {
            res.send(err);
            return;
        }
        let product_total_number = result[0]['COUNT(id)']

    
        let get_product_id =`select products.*, GROUP_CONCAT(DISTINCT concat_ws(",", color.code, color.name) ORDER BY color.no separator ";") AS colors, GROUP_CONCAT(DISTINCT sizes.size ORDER BY FIELD(sizes.size, "S","M","L","XL")) AS sizes, GROUP_CONCAT(DISTINCT concat_ws(",", variant.color_code  ,variant.size , variant.stock) separator ";") AS variants, GROUP_CONCAT(DISTINCT images.images) AS images from products LEFT JOIN color ON products.id = color.id LEFT JOIN sizes ON products.id = sizes.id LEFT JOIN variant ON products.id = variant.id LEFT JOIN images ON products.id = images.id GROUP BY products.id order by id limit ${limit_number} offset ${offset_number}`;
        pool.query(get_product_id ,function (err,rs) {
            if (err){
                res.send(err);
                return;
            };
            
            //如果沒資料則顯error
            if (rs.length ==0){
                var error = {
                    "error": "Invalid token."
                };
                res.send(error);
            }

            let product_list = [];

            for (var i = 0 ; i <rs.length ;i++){

                var data ={};
                data.id  = rs[i].id;
                data.title = rs[i].title;
                data.description = rs[i].description;
                data.price = rs[i].price;
                data.texture = rs[i].texture;
                data.wash = rs[i].wash;
                data.place = rs[i].place;
                data.note = rs[i].note;
                data.story = rs[i].story;

                let color_array = rs[i].colors.split(";").map(item=>{
                    return {
                        code:item.split(",")[0],
                        name:item.split(",")[1]
                    }
                });
                data.colors = color_array;
                
                let size_array = rs[i].sizes.split(",")
                data.sizes = size_array;

                let variant_array = rs[i].variants.split(";").map(item=>{
                    return {
                    color_code:item.split(",")[0],
                    size:item.split(",")[1],
                    stock:Number(item.split(",")[2])
                    }
                });
                data.variants = variant_array;
                data.main_image = rs[i].main_image;

                let image_array = rs[i].images.split(",")
                data.images = image_array;

                product_list.push(data);       
                
            }

            
            if(product_total_number-limit_number*(paging+1) <= 0){  //確保資料已在最後一頁，就不會顯示page

                var page_data ={
                        "data" : product_list,
                    };
                    res.send(page_data);
            }else{
                var page_data ={
                    "data" : product_list,
                    "paging" : paging+1
                };
                res.send(page_data);
            }

        });
    
    });

});

//output all the databases data when attribue = men
app.get("/api/v1/products/men",function(req,res){

    //先把全部產品id抓出來
    let limit_number = 3;
    let paging;
    if (isNaN(req.query.paging)){
        paging=0;
    }else{
        paging = parseInt(req.query.paging);
    }
    let offset_number = 3 * paging;

    let get_product_id =`select products.id from products where attribute = "men" order by id limit ${limit_number} offset ${offset_number}`
    pool.query(get_product_id ,function (err,rs) {
        if (err) throw err;
        //利用迴圈搜尋特定產品id
        var product_list=[];
        var count = 0;
        var count2 = 0;
        
        //如果沒資料則顯error
        if (rs.length ==0){
            var error = {
                "error": "Invalid token."
            };
            res.send(error);
        }


        for (var i = 0 ; i <rs.length ;i++){
            let product_id =rs[i].id;
            var promise_product = new Promise( function(resolve, reject) {
                var sql = `select * from products where products.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results);
                    }
                });
                return promise_product;    
            });
        

            var promise_product_join_color = new Promise( function(resolve, reject) {
                var sql = `select distinct color.code, color.name from color where color.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results);
                    }
                });
                return promise_product_join_color;    
            });
            

            var promise_product_join_sizes = new Promise( function(resolve, reject) {
                var sql = `select * from sizes where sizes.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        var size_array= [];
                        for (var j =0 ; j< results.length;j++){
                            size_array.push(results[j].size);
                            resolve(size_array);
                        }
                    }
                });
                return promise_product_join_sizes;    
            });

            var promise_product_join_variant = new Promise( function(resolve, reject) {
                var sql = `select variant.color_code, variant.size, variant.stock from variant where variant.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else{
                        resolve(results);
                    }
                });
                return promise_product_join_variant;    
            });

            var promise_product_join_images = new Promise( function(resolve, reject) {
                var sql = `select * from images where images.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else{
                        var images_array= [];
                        for (var k =0 ; k< results.length;k++){
                            images_array.push(results[k].images);
                            resolve(images_array);
                        }
                    }
                });
                return promise_product_join_images;    
            });

            //顯示總資料數
            var promise_product_sum = new Promise( function(resolve, reject) {
                var sql = `SELECT COUNT(id) from products where attribute = "men" `;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results[0]["COUNT(id)"]);
                    }
                });
                return promise_product_sum ;    
            });

            
            //在這邊組合成規定的形式
            Promise.all([promise_product, promise_product_join_color, promise_product_join_sizes, promise_product_join_variant,promise_product_join_images,promise_product_sum]).then(function (results) {

                var data ={};
                data.id  = results[0][0].id;
                data.title = results[0][0].title;
                data.description = results[0][0].description;
                data.price = results[0][0].price;
                data.texture = results[0][0].texture;
                data.wash = results[0][0].wash;
                data.place = results[0][0].place;
                data.note = results[0][0].note;
                data.story = results[0][0].story;
                data.colors = results[1];
                data.sizes = results[2];
                data.variants = results[3];
                data.main_image = results[0][0].main_image;
                data.images = results[4];

                count = count + 1;   //確保上面跑完，計數器+1 避免非同步問題 
                
                if (count == rs.length){
                    product_list.push(data);
                    if(results[5]-limit_number*(paging+1) <= 0){  //確保資料已在最後一頁，就不會顯示page

                        var page_data ={
                                "data" : product_list,
                            };
                            res.send(page_data);
                    }else{
                        var page_data ={
                            "data" : product_list,
                            "paging" : paging+1
                        };
                        res.send(page_data);
                    }

                }else{
                    if(count = count2+1){
                        product_list.push(data);
                        count2 = count2+1;
                    }
                }
            });
        }
    });
});

//output all the databases data when attribue = women
app.get("/api/v1/products/women",function(req,res){

    //先把全部產品id抓出來
    let limit_number = 3;
    let paging;
    if (isNaN(req.query.paging)){
        paging=0;
    }else{
        paging = parseInt(req.query.paging);
    }
    let offset_number = 3 * paging;

    let get_product_id =`select products.id from products where attribute = "women" order by id limit ${limit_number} offset ${offset_number}`
    pool.query(get_product_id ,function (err,rs) {
        if (err) throw err;
        //利用迴圈搜尋特定產品id
        var product_list=[];
        var count = 0;
        var count2 = 0;
        
        //如果沒資料則顯error
        if (rs.length ==0){
            var error = {
                "error": "Invalid token."
            };
            res.send(error);
        }


        for (var i = 0 ; i <rs.length ;i++){
            let product_id =rs[i].id;
            var promise_product = new Promise( function(resolve, reject) {
                var sql = `select * from products where products.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results);
                    }
                });
                return promise_product;    
            });
        

            var promise_product_join_color = new Promise( function(resolve, reject) {
                var sql = `select distinct color.code, color.name from color where color.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results);
                    }
                });
                return promise_product_join_color;    
            });
            

            var promise_product_join_sizes = new Promise( function(resolve, reject) {
                var sql = `select * from sizes where sizes.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        var size_array= [];
                        for (var j =0 ; j< results.length;j++){
                            size_array.push(results[j].size);
                            resolve(size_array);
                        }
                    }
                });
                return promise_product_join_sizes;    
            });

            var promise_product_join_variant = new Promise( function(resolve, reject) {
                var sql = `select variant.color_code, variant.size, variant.stock from variant where variant.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results);
                    }
                });
                return promise_product_join_variant;    
            });

            var promise_product_join_images = new Promise( function(resolve, reject) {
                var sql = `select * from images where images.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        var images_array= [];
                        for (var k =0 ; k< results.length;k++){
                            images_array.push(results[k].images);
                            resolve(images_array);
                        }
                    }
                });
                return promise_product_join_images;    
            });

            //顯示總資料數
            var promise_product_sum = new Promise( function(resolve, reject) {
                var sql = `SELECT COUNT(id) from products where attribute = "women" `;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results[0]["COUNT(id)"]);
                    }
                });
                return promise_product_sum;    
            });

            
            //在這邊組合成規定的形式
            Promise.all([promise_product, promise_product_join_color, promise_product_join_sizes, promise_product_join_variant,promise_product_join_images,promise_product_sum]).then(function (results) {

                var data ={};
                data.id  = results[0][0].id;
                data.title = results[0][0].title;
                data.description = results[0][0].description;
                data.price = results[0][0].price;
                data.texture = results[0][0].texture;
                data.wash = results[0][0].wash;
                data.place = results[0][0].place;
                data.note = results[0][0].note;
                data.story = results[0][0].story;
                data.colors = results[1];
                data.sizes = results[2];
                data.variants = results[3];
                data.main_image = results[0][0].main_image;
                data.images = results[4];

                count = count + 1;   //確保上面跑完，計數器+1 避免非同步問題 
                
                if (count == rs.length){
                    product_list.push(data);
                    if(results[5]-limit_number*(paging+1) <= 0){  //確保資料已在最後一頁，就不會顯示page
                        var page_data ={
                                "data" : product_list,
                            }
                            res.send(page_data);
                    }else{
                        var page_data ={
                            "data" : product_list,
                            "paging" : paging+1
                        };
                        res.send(page_data);
                    }

                }else{
                    if(count = count2+1){
                        product_list.push(data);
                        count2 = count2+1;
                    }
                }
            });
        }
    });
});

//output all the databases data when attribue = accessories
app.get("/api/v1/products/accessories",function(req,res){

    //先把全部產品id抓出來
    let limit_number = 3;
    let paging;
    if (isNaN(req.query.paging)){
        paging=0;
    }else{
        paging = parseInt(req.query.paging);
    }
    let offset_number = 3 * paging;

    let get_product_id =`select products.id from products where attribute = "accessories" order by id limit ${limit_number} offset ${offset_number}`
    pool.query(get_product_id ,function (err,rs) {
        if (err) throw err;
        //利用迴圈搜尋特定產品id
        var product_list=[];
        var count = 0;
        var count2 = 0;
        
        //如果沒資料則顯error
        if (rs.length ==0){
            var error = {
                "error": "Invalid token."
            };
            res.send(error);
        }


        for (var i = 0 ; i <rs.length ;i++){
            let product_id =rs[i].id;
            var promise_product = new Promise( function(resolve, reject) {
                var sql = `select * from products where products.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results);
                    }
                });
                return promise_product;    
            });
        

            var promise_product_join_color = new Promise( function(resolve, reject) {
                var sql = `select distinct color.code, color.name from color where color.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results);
                    }
                });
                return promise_product_join_color;    
            });
            

            var promise_product_join_sizes = new Promise( function(resolve, reject) {
                var sql = `select * from sizes where sizes.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        var size_array= [];
                        for (var j =0 ; j< results.length;j++){
                            size_array.push(results[j].size);
                            resolve(size_array);
                        }
                    }
                });
                return promise_product_join_sizes;    
            })

            var promise_product_join_variant = new Promise( function(resolve, reject) {
                var sql = `select variant.color_code, variant.size, variant.stock from variant where variant.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results);
                    }
                });
                return promise_product_join_variant;    
            });

            var promise_product_join_images = new Promise( function(resolve, reject) {
                var sql = `select * from images where images.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        var images_array= [];
                        for (var k =0 ; k< results.length;k++){
                            images_array.push(results[k].images);
                            resolve(images_array);
                        }
                    }
                });
                return promise_product_join_images;    
            });

            //顯示總資料數
            var promise_product_sum = new Promise( function(resolve, reject) {
                var sql = `SELECT COUNT(id) from products where attribute = "accessories" `;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results[0]["COUNT(id)"]);
                    }
                });
                return promise_product_sum ;    
            });

            
            //在這邊組合成規定的形式
            Promise.all([promise_product, promise_product_join_color, promise_product_join_sizes, promise_product_join_variant,promise_product_join_images,promise_product_sum]).then(function (results) {

                var data ={};
                data.id  = results[0][0].id;
                data.title = results[0][0].title;
                data.description = results[0][0].description;
                data.price = results[0][0].price;
                data.texture = results[0][0].texture;
                data.wash = results[0][0].wash;
                data.place = results[0][0].place;
                data.note = results[0][0].note;
                data.story = results[0][0].story;
                data.colors = results[1];
                data.sizes = results[2];
                data.variants = results[3];
                data.main_image = results[0][0].main_image;
                data.images = results[4];

                count = count + 1;   //確保上面跑完，計數器+1 避免非同步問題 
                
                if (count == rs.length){
                    product_list.push(data);
                    if(results[5]-limit_number*(paging+1) <= 0){  //確保資料已在最後一頁，就不會顯示page

                        var page_data ={
                                "data" : product_list,
                            };
                            res.send(page_data);
                    }else{
                        var page_data ={
                            "data" : product_list,
                            "paging" : paging+1
                        };
                        res.send(page_data);
                    }

                }else{
                    if(count = count2+1){
                        product_list.push(data);
                        count2 = count2+1;
                    }
                }
            });
        }
    });
});

//output all the databases data when search some conditions
app.get("/api/v1/products/search",function(req,res){

    //先把全部產品id抓出來
    let limit_number = 3;
    let paging;
    if (isNaN(req.query.paging)){
        paging=0;
    }else{
        paging = parseInt(req.query.paging);
    }
    let offset_number = 3 * paging;

    let search_keyword;

    if (!("keyword" in req.query) ){
        var error = {
            "error": "Invalid token."
        };
        throw new Error(res.send(error));
    }else{
        if(req.query.keyword.length ==0){
            var error = {
                "error": "Invalid token."
            };
            throw new Error(res.json(error));
        }else{
            search_keyword = `"%${req.query.keyword}%"`;
        }
    }

    let get_product_id =`select products.id from products where products.title LIKE ${search_keyword} order by id limit ${limit_number} offset ${offset_number}`
    pool.query(get_product_id ,function (err,rs) {
        if (err) throw err;
        //利用迴圈搜尋特定產品id
        var product_list=[];
        var count = 0;
        var count2 = 0;
        
        //如果沒資料則顯error
        if (rs.length ==0){
            var error = {
                "error": "Invalid token."
            };
            res.send(error);
        }


        for (var i = 0 ; i <rs.length ;i++){
            let product_id =rs[i].id;
            var promise_product = new Promise( function(resolve, reject) {
                var sql = `select * from products where products.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results);
                    }
                });
                return promise_product;    
            });
        

            var promise_product_join_color = new Promise( function(resolve, reject) {
                var sql = `select distinct color.code, color.name from color where color.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results);
                    }
                });
                return promise_product_join_color;    
            });
            

            var promise_product_join_sizes = new Promise( function(resolve, reject) {
                var sql = `select * from sizes where sizes.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        var size_array= [];
                        for (var j =0 ; j< results.length;j++){
                            size_array.push(results[j].size);
                            resolve(size_array);
                        }
                    }
                });
                return promise_product_join_sizes;    
            });

            var promise_product_join_variant = new Promise( function(resolve, reject) {
                var sql = `select variant.color_code, variant.size, variant.stock from variant where variant.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results);
                    }
                });
                return promise_product_join_variant;    
            });

            var promise_product_join_images = new Promise( function(resolve, reject) {
                var sql = `select * from images where images.id = ${product_id}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        var images_array= [];
                        for (var k =0 ; k< results.length;k++){
                            images_array.push(results[k].images);
                            resolve(images_array);
                        }
                    }
                });
                return promise_product_join_images;    
            });

            //顯示總資料數
            var promise_product_sum = new Promise( function(resolve, reject) {
                var sql = `SELECT COUNT(id) from products where products.title LIKE ${search_keyword}`;
                pool.query(sql, function (err, results) {
                    if (err || results.length === 0) {
                        reject();
                    }else {
                        resolve(results[0]["COUNT(id)"]);
                    }
                });
                return promise_product_sum ;    
            });

            
            //在這邊組合成規定的形式
            Promise.all([promise_product, promise_product_join_color, promise_product_join_sizes, promise_product_join_variant,promise_product_join_images,promise_product_sum]).then(function (results) {

                var data ={};
                data.id  = results[0][0].id;
                data.title = results[0][0].title;
                data.description = results[0][0].description;
                data.price = results[0][0].price;
                data.texture = results[0][0].texture;
                data.wash = results[0][0].wash;
                data.place = results[0][0].place;
                data.note = results[0][0].note;
                data.story = results[0][0].story;
                data.colors = results[1];
                data.sizes = results[2];
                data.variants = results[3];
                data.main_image = results[0][0].main_image;
                data.images = results[4];

                count = count + 1;   //確保上面跑完，計數器+1 避免非同步問題 
                
                if (count == rs.length){
                    product_list.push(data);
                    if(results[5]-limit_number*(paging+1) <= 0){  //確保資料已在最後一頁，就不會顯示page
                        
                        var page_data ={
                                "data" : product_list,
                            };
                            console.log(page_data);
                            res.send(page_data);
                    }else{
                        var page_data ={
                            "data" : product_list,
                            "paging" : paging+1
                        };
                        res.send(page_data);
                    }

                }else{
                    if(count = count2+1){
                        product_list.push(data);
                        count2 = count2+1;
                    }
                }
            });

        }
    });

});

//output all the databases data when id is certain number
app.get("/api/v1/products/details",function(req,res){

    let detail_id;

    if (!("id" in req.query) ){
        var error = {
            "error": "Invalid token."
        };
        throw new Error(res.send(error));
    }else{
        if(req.query.id.length ==0){
            var error = {
                "error": "Invalid token."
            };
            throw new Error(res.send(error));
        }else{
            detail_id = parseInt(`${req.query.id}`);

        }
        
    }
    
    //優化 一次 query 的寫法 
    myCache.get( `product_id_${parseInt(detail_id)}`, function( err, value ){
        if( !err ){
            if(value == undefined){
                let get_product_id =`select products.*, GROUP_CONCAT(DISTINCT concat_ws(",", color.code, color.name) ORDER BY color.no separator ";") AS colors, GROUP_CONCAT(DISTINCT sizes.size ORDER BY FIELD(sizes.size, "S","M","L","XL")) AS sizes, GROUP_CONCAT(DISTINCT concat_ws(",", variant.color_code  ,variant.size , variant.stock) separator ";") AS variants, GROUP_CONCAT(DISTINCT images.images) AS images from products LEFT JOIN color ON products.id = color.id LEFT JOIN sizes ON products.id = sizes.id LEFT JOIN variant ON products.id = variant.id LEFT JOIN images ON products.id = images.id where products.id = ${detail_id} GROUP BY products.id `;
                pool.query(get_product_id ,function (err,rs) {
                    if (err){
                        res.send(err);
                        return;
                    };
                    
                    //如果沒資料則顯error
                    if (rs.length ==0){
                        var error = {
                            "error": "Invalid token."
                        };
                        res.send(error);
                    }
        
                    let product_list = []
        
                    var data ={};
                    data.id  = rs[0].id;
                    data.title = rs[0].title;
                    data.description = rs[0].description;
                    data.price = rs[0].price;
                    data.texture = rs[0].texture;
                    data.wash = rs[0].wash;
                    data.place = rs[0].place;
                    data.note = rs[0].note;
                    data.story = rs[0].story;
    
                    let color_array = rs[0].colors.split(";").map(item=>{
                        return {
                            code:item.split(",")[0],
                            name:item.split(",")[1]
                        }
                    })
                    data.colors = color_array;
                    
                    let size_array = rs[0].sizes.split(",")
                    data.sizes = size_array;
    
                    let variant_array = rs[0].variants.split(";").map(item=>{
                        return {
                            color_code:item.split(",")[0],
                            size:item.split(",")[1],
                            stock:Number(item.split(",")[2])
                        }
                    })
                    data.variants = variant_array;
                    data.main_image = rs[0].main_image;
    
                    let image_array = rs[0].images.split(",")
                    data.images = image_array;
    
                    product_list.push(data);
                    
                    var page_data ={
                        "data" : product_list,
                    };
                    res.send(page_data);
                    
                });
            }else{
                res.send(value);
            }
        }
    });




    
});

//user input the campaign data from campaign.html and send here
app.post("/admin/campaign", admin.fields([{name:'picture',maxCount:20}]),function(req,res){

    //input insert to database test table campaign 
    if (typeof req.body.product_id == "string"){
        const campaign_object={
            product_id:parseInt(req.body.product_id),
            picture:req.files['picture'][0].location,
            story:req.body.story
        };
        pool.query('insert into campaign set ?',campaign_object,function (err,rs) {
            if (err) throw err;

            myCache.del( "campaign_data", function( err, count ){
                if( !err ){
                    console.log("刪除 cache"); 
                }
            });

        });
    }else{
        for (var i = 0 ;i <req.body.product_id.length ;i++){ 
            var campaign_object={
                product_id:parseInt(req.body.product_id[i]),
                picture:req.files['picture'][i].location,
                story:req.body.story[i]
            };
            pool.query('insert into campaign set ?',campaign_object,function (err,rs) {
                if (err) throw err;

                myCache.del( "campaign_data", function( err, count ){
                    if( !err ){
                        console.log("刪除 cache"); 
                    }
                });


            });
        }    
    }
    res.redirect('/')
});

//output all the campaigns data
app.get("/api/v1/marketing/campaigns",function(req,res){

    myCache.get( "campaign_data", function( err, value ){
        if( !err ){
            if(value == undefined){
                //先把全部產品id抓出來

                let get_product_id =`select campaign.product_id from campaign order by product_id`
                pool.query(get_product_id ,function (err,rs) {
                    if (err) throw err;
                    //利用迴圈搜尋特定產品id
                    var campaign_list=[];
                    var count = 0;
                    var count2 = 0;
                    //如果沒資料則顯error
                    if (rs.length ==0){
                        var error = {
                            "error": "Invalid token."
                        };
                        res.send(error);
                    }


                    for (var i = 0 ; i <rs.length ;i++){
                        
                        
                        let product_id =rs[i].product_id;
                    
                        
                        var promise_campaign = new Promise( function(resolve, reject) {
                            var sql = `select * from campaign where campaign.product_id = ${product_id}`;
                            pool.query(sql, function (err, results) {
                                if (err || results.length === 0) {
                                    reject();
                                }else {
                                    resolve(results);
                                }
                            });
                            return promise_campaign;    
                        });
                        
                        //在這邊組合成規定的形式
                        Promise.all([promise_campaign]).then(function (results) {
                            
                            var data ={};
                            data.product_id  = results[0][0].product_id;
                            data.picture = results[0][0].picture;
                            data.story = results[0][0].story;

                            count = count + 1;   //確保上面跑完，計數器+1 避免非同步問題 
                            
                            if (count == rs.length){
                                campaign_list.push(data);
                                var total_data ={
                                    "data" : campaign_list,
                                };
                                
                                
                                myCache.set( "campaign_data", total_data, function( err, success ){
                                    if( !err && success ){
                                        console.log("cache 設置成功"+ success );

                                    }
                                });

                                res.send(total_data);
                                

                            }else{
                                if(count = count2+1){
                                    campaign_list.push(data);
                                    count2 = count2+1;
                                }
                            }
                        });

                    }

                });
            
            }else{
                res.send(value);
            }
        }
    });
});

//user input the user data from sigh_up.html and send here
app.post("/user/signup",function(req,res){

    if(req.header('Content-Type') != "application/json"){
        var error = {
            "error": "Invalid request body."
        };
        res.send(error); 
    }else{
    
        //input insert to database test table user 
        if (req.body.name.length ==0 || req.body.email.length ==0 || req.body.password.length ==0){
            res.send("name or email are not empty");
        }else{
            
            //除了查詢 email 有無相同外，因為臉書註冊者也有可能使用相同信箱，所以要增加 native 的判斷
            pool.query(`select email from user where email = "${req.body.email}" and provider = "native" `,function (err,rs) {
                if (err) throw err;
                
                if (rs.length >=1){
                    res.send("email duplicate");             
                    
                }else{
                    
                    //密碼加密
                    const hash_password = crypto.createHash('sha256');
                    hash_password.update(req.body.password);
                    
                    
                    const user_object={
                        provider:"native",
                        name:req.body.name,
                        email:req.body.email,
                        password:hash_password.digest('hex'),
                        picture:"user_default_image.jpg",
                    };
                    
                
                    pool.query('insert into user set ?',user_object,function (err,rs) {
                        if (err) throw err;
                    });
                    
                }
        
            });

        }

        // create access token
        const hash_time = crypto.createHash('sha256');
        hash_time.update(String(Date.now()));
        var access_token = crypto.randomBytes(48).toString('hex')+hash_time.digest('hex');
        const user_token_object={
            access_token:access_token,
            access_expired:Date.now()+ 7.2e+6,
            email:req.body.email,
        };

        
        //input insert to database test table user_token
        pool.query('insert into user_token set ?',user_token_object,function (err,rs) {
            if (err) throw err;
        

            //output the user and user_token ，包在 insert 裡面確保不會不同步，會有同時多位註冊者的問題，所以此方式最保險
            var sql =`select user.id, user.provider, user.name, user.email, user.picture, user_token.access_token,user_token.access_expired from user , user_token WHERE user.email ='${req.body.email}' and user_token.email = '${req.body.email}' `;
            pool.query(sql, function (err, results) {
                if (err) throw err; 
                var user = {};            //usr_objection
                user.id = results[0].id;
                user.provider = results[0].provider;
                user.name = results[0].name;
                user.eamil = results[0].email;
                user.picture = results[0].picture;

                var dataobject = {};
                dataobject.access_token = results[0].access_token;
                dataobject.access_expired = results[0].access_expired;
                dataobject.user = user;
    
                var sign_up_object = {};
                sign_up_object.data =  dataobject;

                res.send(sign_up_object);

                
            });

        });
    }

});

//user input the user data from sigh_in.html and send here
app.post("/user/signin",function(req,res){

    if(req.header('Content-Type') != "application/json"){
        var error = {
            "error": "Invalid request body."
        };
        console.log(error);
    }else{
        if(req.body.provider == "facebook"){
            var user_fb_token =req.body.access_token;
            var fb =`https://graph.facebook.com/v3.3/me?fields=email,name,picture.width(400).height(500)&access_token=${user_fb_token}`;
            
            request({url: fb}, function (error, response, body) {
                body = JSON.parse(body);
                //臉書註冊者，先判斷信箱有無在資料庫裡，若有就只更新 token 跟時間，若無就插入到資料庫裡
                pool.query(`select email from user where email = "${body.email}" and provider = "facebook" `,function (err,rs) {
                    if (err) throw err;
                    if (rs.length >=1){
                        
                        // create new access token
                        const hash_fb_time = crypto.createHash('sha256');
                        hash_fb_time.update(String(Date.now()));
                        var new_fb_access_token = crypto.randomBytes(48).toString('hex')+hash_fb_time.digest('hex');
                        const fb_access_expired = Date.now()+ 7.2e+6;
                        

                        //input insert to database test table user_token
                        pool.query(`UPDATE user_token SET access_token ="${new_fb_access_token}", access_expired ="${fb_access_expired}" WHERE email = "${body.email}"`,function (err,rs) {
                            if (err) throw err;
                            
                            
                            //output the user and user_token ，包在 insert 裡面確保不會不同步
                                var sql =`select user.id, user.provider, user.name, user.email, user.picture, user_token.access_token,user_token.access_expired from user , user_token WHERE user.email ='${body.email}' and user_token.email = '${body.email}' `;
                                pool.query(sql, function (err, results) {
                                    if (err) throw err; 
                                    
                                    var user = {};            //usr_objection
                                    user.id = results[0].id;
                                    user.provider = results[0].provider;
                                    user.name = results[0].name;
                                    user.eamil = results[0].email;
                                    user.picture = results[0].picture;

                                    var dataobject = {};
                                    dataobject.access_token = results[0].access_token;
                                    dataobject.access_expired = results[0].access_expired;
                                    dataobject.user = user;
                        
                                    var sign_up_object = {};
                                    sign_up_object.data =  dataobject;

                                    res.send(sign_up_object);

                        
                                });
                

                        });


                    }else{

                        const user_fb_object={
                            provider:"facebook",
                            name:body.name,
                            email:body.email,
                            password:"0",
                            picture:body.picture.data.url,
                        };
                    
                        pool.query('insert into user set ?',user_fb_object,function (err,rs) {
                            if (err) throw err;
                        })

                        const hash_fb_time = crypto.createHash('sha256');
                        hash_fb_time.update(String(Date.now()));
                        var fb_access_token = crypto.randomBytes(48).toString('hex')+hash_fb_time.digest('hex');
                        const user_fb_token_object={
                            access_token:fb_access_token,
                            access_expired:Date.now()+ 7.2e+6,
                            email:body.email,
                        };


                        //input insert to database test table user_token
                        pool.query('insert into user_token set ?',user_fb_token_object,function (err,rs) {
                            if (err) throw err;

                            //output the user and user_token ，包在 insert 裡面確保不會不同步，會有同時多位註冊者的問題，所以此方式最保險
                            var sql =`select user.id, user.provider, user.name, user.email, user.picture, user_token.access_token,user_token.access_expired from user , user_token WHERE user.email ='${body.email}' and user_token.email = '${body.email}' `;
                            pool.query(sql, function (err, results) {
                                if (err) throw err; 
                                
                                var user = {};            //usr_objection
                                user.id = results[0].id;
                                user.provider = results[0].provider;
                                user.name = results[0].name;
                                user.eamil = results[0].email;
                                user.picture = results[0].picture;

                                var dataobject = {};
                                dataobject.access_token = results[0].access_token;
                                dataobject.access_expired = results[0].access_expired;
                                dataobject.user = user;
                    
                                var sign_up_object = {};
                                sign_up_object.data =  dataobject;

                                res.send(sign_up_object);

                                
                            });

                        });
                    }
                });
            });
        }else{ 
            //密碼加密後才能查詢資料庫
            const hash_password = crypto.createHash('sha256');
            hash_password.update(req.body.password);
            const crypto_passord = hash_password.digest('hex');
                
            
            pool.query(`select user.email, user.password from user where user.email = "${req.body.email}" and user.password = "${crypto_passord}"` ,function (err,rs) {
                if (err) throw err;
                
                if (rs.length == 0){
                    res.send("error") ;
                }else{

                    // create new access token
                    const hash_time = crypto.createHash('sha256');
                    hash_time.update(String(Date.now()));
                    var new_access_token = crypto.randomBytes(48).toString('hex')+hash_time.digest('hex');
                    const access_expired = Date.now()+ 7.2e+6;
                    
                    //input insert to database test table user_token
                    pool.query(`UPDATE user_token SET access_token ="${new_access_token}", access_expired ="${access_expired}" WHERE email = "${req.body.email}"`,function (err,rs) {
                        if (err) throw err;

                        //output the user and user_token ，包在 insert 裡面確保不會不同步
                        var sql =`select user.id, user.provider, user.name, user.email, user.picture, user_token.access_token,user_token.access_expired from user , user_token WHERE user.email ='${req.body.email}' and user_token.email = '${req.body.email}' `;
                        pool.query(sql, function (err, results) {
                            if (err) throw err; 
                            
                            var user = {};     //usr_objection
                            user.id = results[0].id;
                            user.provider = results[0].provider;
                            user.name = results[0].name;
                            user.eamil = results[0].email;
                            user.picture = results[0].picture;

                            var dataobject = {};
                            dataobject.access_token = results[0].access_token;
                            dataobject.access_expired = results[0].access_expired;
                            dataobject.user = user;
                
                            var sign_up_object = {};
                            sign_up_object.data =  dataobject;

                            res.send(sign_up_object);

                
                        });
            

                    })
                
                }
            
            });
        }

    }

});
    
//output the user profile 
app.get("/user/profile",function(req,res){


    var user_Bearer_token = req.headers.authorization;
    user_Bearer_token = user_Bearer_token.split(" ");

    if(user_Bearer_token[0] != "Bearer"  ){
        console.log("not a Bearer token");
    }else{
        //output the user and user_token 
        var sql = `select user_token.email from user_token  WHERE user_token.access_token =  '${user_Bearer_token[1]}'`;
        pool.query(sql, function (err, results) {
            if (err) throw err; 
            
            if(results.length == 0){
                res.send("error");
            }else{
                var mysql =`select user.id, user.provider, user.name, user.email, user.picture from user join user_token  on user_token.id =  user.id  WHERE user_token.access_token =  '${user_Bearer_token[1]}'`;
                pool.query(mysql, function (err, result) {
                    if (err) throw err; 
                    
                    var user = {};            //usr_objection
                    user.id = result[0].id;
                    user.provider = result[0].provider;
                    user.name = result[0].name;
                    user.email = result[0].email;
                    user.picture = result[0].picture;
                    
                    var profile_object = {};
                    profile_object.data =  user;
                
                    res.send(profile_object);
                
                })
                
                
            }
        
        });
    }


    
    
});

//user input the user data from sigh_in.html and send here
app.post("/order/checkout",function(req,res){

    if(req.header('Content-Type') != "application/json"){
        var error = {
            "error": "Invalid request body."
        };
        return res.send(error);
    }



    if(req.headers.authorization == null){ 
        var token = "";
    }else{
        var user_Bearer_token = req.headers.authorization;
        user_Bearer_token = user_Bearer_token.split(" ");
    
    
        if(user_Bearer_token[0] != "Bearer"  ){
            return res.send("error");
            
        }else{
            var token =user_Bearer_token[1];
        }
    }



    var order_number = Date.now();
    
    var user_order_object={
        user_id: "",
        order_number: order_number,
        payment_statement: "unpaid",
        prime: req.body.prime,
        shipping: req.body.order.shipping,
        payment: req.body.order.payment,
        subtotal: parseInt(req.body.order.subtotal),
        freight: parseInt(req.body.order.freight),
        total: parseInt(req.body.order.total),
        name: req.body.order.recipient.name,
        phone: req.body.order.recipient.phone,
        email: req.body.order.recipient.email,
        address: req.body.order.recipient.address,
        time: req.body.order.recipient.time
    };

    const post_data = {
        "prime": req.body.prime,
        "partner_key": "",
        "merchant_id": "",
        "amount": parseInt(req.body.order.total),
        "details": `'${order_number}'`,
        "cardholder": {
            "phone_number": req.body.order.recipient.phone,
            "name":  req.body.order.recipient.name,
            "email": req.body.order.recipient.email
        },
        "remember": false
    };

    const post_options = {
        uri: 'https://sandbox.tappaysdk.com/tpc/payment/pay-by-prime',
        port: 443,
        body: post_data,
        json: true,
        method: "POST",
        headers: {
            'Content-Type': '',
            'x-api-key': ''
        }
    };


    async.waterfall([function(next){
        pool.query(`select * from user_token where access_token= '${token}'` ,function (err1,result1) {
            if (err1) throw err1;
            if (result1.length>0){
                if(result1[0].access_expired-order_number<0){ 
                    return res.redirect('/admin/sign_in.html');
                }else{
                    user_order_object.user_id = result1[0].id;
                }
            }else{
                user_order_object.user_id = 0;
            }
            
            pool.query('insert into user_order set ?',user_order_object,function (err2,result2) {
                if (err2) throw err2;
                next(err2, result2);
            });
            
        });
    },
    function(result2, next){
        let user_order_list =[];

        for(let i = 0; i <req.body.order.list.length; i++){
            let user_order_list_array =
                [order_number, req.body.order.list[i].id, req.body.order.list[i].name, parseInt(req.body.order.list[i].price), req.body.order.list[i].color.code, req.body.order.list[i].color.name, req.body.order.list[i].size, parseInt(req.body.order.list[i].qty)];
                user_order_list.push(user_order_list_array);
            }
        
        pool.query('insert into user_order_list (order_number, id, name, price, color_code, color_name, size, qty) values ?',[user_order_list],function (err3,result3) {
            if (err3) throw err3;
            next(err3, result3);
                
        })  
        
        
    }],
    function(result2,result3, next){
        request(post_options, function (err4, response, body) {

            if(body.status !==0){
                let user_order_statment_object ={
                    order_number: order_number,
                    prime: req.body.prime,
                    status: parseInt(body.status),
                    msg: body.msg
                };
                pool.query('insert into user_order_statment set ?',user_order_statment_object,function (err5,result4) {
                    if (err5) throw err5;
                    pool.query(`UPDATE user_order SET payment_statement ="paid"  WHERE order_number = "${order_number}"`,function (err,result) {
                        if (err) throw err;
                        res.send("error");
                    });
                    
                });
            }else{                
                let user_order_statment_object ={
                    order_number: order_number,
                    prime: req.body.prime,
                    status: parseInt(body.status),
                    msg: body.msg,
                    rec_trade_id: body.rec_trade_id,
                    bank_transaction_id: body.bank_transaction_id,
                    auth_code: body.auth_code,
                    amount : parseInt(body.amount),
                    card_info: JSON.stringify(body.card_info),
                    acquire: body.acquire,
                    transaction_time_millis: parseInt(body.transaction_time_millis),
                    bank_transaction_time: JSON.stringify(body.bank_transaction_time),
                    bank_result_code: body.bank_result_code,
                    bank_result_msg: body.bank_result_msg,
                    card_identifier: body.card_identifier

                };
                pool.query('insert into user_order_statment set ?',user_order_statment_object,function (err5,result4) {
                    if (err5){
                        var final_data ={
                            data: {
                                number: order_number 
                            }
                        };
                        res.send(final_data);
                    }else{
                        pool.query(`UPDATE user_order SET payment_statement ="paid"  WHERE order_number = "${order_number}"`,function (err,result) {
                            if (err) throw err;
                            var final_data ={
                                data: {
                                    number: order_number 
                                }
                            };
                            res.send(final_data);
                        });
                    }

                    
                });
            
            }
        });
        
    });

});





app.listen(3000,function(){
    console.log("Server is running in http://localhost:3000/")
});