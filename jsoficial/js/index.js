function escrita(elemento){
    const textoArray = elemento.innerHTML.split('');
    elemento.innerHTML = '';

    textoArray.forEach((letra, i) => {
        setTimeout(function(){
            elemento.innerHTML += letra;
        },80*i)
    });
}

const animacao = document.querySelector('h2');
escrita(animacao);
