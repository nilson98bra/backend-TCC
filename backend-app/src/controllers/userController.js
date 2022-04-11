const handlingErrors = require("../handling/handling")
const User = require("../models/user");
const {v4:uuid} = require("uuid")
const sendEmail = require("../config/smtp")
const moment = require("moment")
const jwt = require("jsonwebtoken")
require('dotenv').config({path:'./.env'})

function generateCode(min, max){
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.cadUserEmail= async(req,res)=>{
    try{
        const {email} = req.body
        const emailValues = {"email":email}
        const emailErros = await handlingErrors.validateEmail(emailValues)

        if(emailErros.length !=0){
            return res.status(400).send({"mensagem":emailErros})
        }

        const exist = await User.findOne({$and:[
            {"email":email},
            {"provisionalRegistration":false}
        ]})
            
      
        if(exist){

            return res.status(400).send({"error": "Este email já está cadastrado"})    
        }

        const verifyCode = generateCode(100000,999999)

        const existProvisional = await User.findOne({"email":email},{"provisionalRegistration":true})
        
        if(existProvisional){
            await User.findOneAndUpdate({email:email},{verifyCode: verifyCode, verifyCodeDate:new Date().toISOString()})
        }
        else{
            await User.create({ 
                _id: uuid(),
                email: email,
                nameUser: "Default",
                notifyInitBathymetry:false,
                notifyEndBathymetry:false,
                notifyObstacle:false,
                verifyCode: verifyCode,
                verifyCodeDate: new Date().toISOString(),
                provisionalRegistration:true
            })
        }

        await sendEmail(verifyCode,email)

        return res.status(201).send({"message":"Código de verificação enviado"})  
   
    }catch(error){
        return res.status(400).send({"mensagem":error})
    }
    
}

exports.sendEmail = async(req,res)=>{

    const {email} = req.body
    const emailValues = {"email":email}
    const emailErros = await handlingErrors.validateEmail(emailValues)

    if(emailErros.length !=0){
        return res.status(400).send({"mensagem":emailErros})
    }

    const verifyCode = generateCode(100000,999999)

    
    const user = await User.findOneAndUpdate({email:email},{verifyCode: verifyCode, verifyCodeDate:new Date().toISOString()},{new: true})
    
    if(user){
        await sendEmail(verifyCode,email)
        
        return res.status(200).send({"message":"E-mail com o código de verificação enviado com sucesso!"})  
    }

    return res.status(401).send({"message":"E-mail não encontrado!"})  

}

exports.cadUserEspec= async(req,res)=>{

    const {nameUser, notifyInitBathymetry, notifyEndBathymetry, notifyObstacle} = req.body
    
    const stringValues = {"nameUser":nameUser}
    const booleanValues = {"notifyInitBathymetry":notifyInitBathymetry,
    "notifyEndBathymetry":notifyEndBathymetry,"notifyObstacle":notifyObstacle}
    const stringErros = await handlingErros.validateString(stringValues, [15,36],[4,36])
    const booleanErros = await handlingErrors.validBooleanValues(booleanValues)

    const erros = stringErros.concat(booleanErros)
    if(erros){
        return res.status(400).send({"mensagem":erros})
    }

    await User.findByIdAndUpdate({_id:req.user._id},{nameUser:nameUser, 
        notifyInitBathymetry: notifyInitBathymetry,notifyEndBathymetry:  notifyEndBathymetry,
        notifyObstacle: notifyObstacle})

    return res.status(201).send({"message": "Detalhes Atualizados"})

}

exports.verifyCode = async(req,res)=>{
    
        const {email, code} = req.body
        const numericValues = {"code":code}
        const emailValues = {"email":email}
        const numericErros = await handlingErrors.validNumericValues(numericValues, [6],[6])
        const emailErros = await handlingErrors.validateEmail(emailValues)

        const erros = numericErros.concat(emailErros)

        if(erros.length != 0){
            return res.status(400).send({"erros":erros})
        } 

        const user = await User.findOne({"email":email})
        if(user){
        
            let now = moment(new Date())
            const duration = moment.duration(now.diff(user.verifyCodeDate));
     
            console.log(user.verifyCode)
            if(user.verifyCode == code){

                if(duration.asMinutes()>8){
                    return res.status(403).send({"erro":"Código Expirado!"})
                }

                const existProvisional = await User.findOne({"email":email},{"provisionalRegistration":true})
        
                if(existProvisional){
                    await User.findOneAndUpdate({email:email},{provisionalRegistration:false})
                }
                const token = jwt.sign({
                    _id: user._id,
                    email: email
                },process.env.JWT_KEY,{
                    expiresIn: "10h"
                })
                const refreshToken = jwt.sign({
                    _id: user._id,
                    email: email
                },process.env.JWT_REFRESH_KEY,{
                    expiresIn: "100h"
                })

               
                return res.status(200).send({"token":token, "refreshToken":refreshToken})
            }
            return res.status(401).send({"message":"Código Inválido!"})
        }
        return res.status(401).send({"message":"Esse e-mail não existe no sistema!"})
        
  
}


exports.login = async(req,res)=>{
    try{
        const {email} = req.body
        const emailValues = {"email":email}
        const emailErros = await handlingErrors.validateEmail(emailValues)

        if(emailErros.length != 0){
            return res.status(400).send({"mensagem":emailErros})
        }

        const verifyCode = generateCode(100000,999999)
        const user = await User.findOneAndUpdate({$and:[
            {"email":email},
            {"provisionalRegistration":false}
        ]},{verifyCode: verifyCode, verifyCodeDate:new Date().toISOString()},{new: true})
    
        if(!user){
            return res.status(401).send({"error": "E-mail não encontrado"})    
        }
        await sendEmail(verifyCode,email)
            
        return res.status(200).send({"message":true,
        "e-mail":"E-mail com o código de verificação enviado com sucesso!"})  
        
    }catch(error){
        return res.status(400).send({"message":error})
    }
}





